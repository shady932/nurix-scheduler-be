"use strict";

const { randomUUID } = require("crypto");
const { initDb, getDb } = require("../database");
const { persistLog } = require("../helpers");

const WORKER_ID = `worker-${randomUUID()}`;
const LEASE_MS = Number(process.env.LEASE_MS || 30_000);
const POLL_MS = Number(process.env.POLL_MS || 500);
let TASK_HANDLERS = {};
let db;

const sleep = (ms) => {
  return new Promise((r) => setTimeout(r, ms));
};

const claimNextJob = (workerId, leaseMs = LEASE_MS) => {
  const now = Date.now();
  const leaseUntil = now + leaseMs;

  const tx = db.transaction(() => {
    const candidate = db
      .prepare(
        `SELECT id FROM jobs
         WHERE (status = 'pending'
           OR (status = 'failed' AND retries < max_retries AND (next_attempt_after IS NULL OR next_attempt_after <= ?)))
         ORDER BY created_at ASC
         LIMIT 1`
      )
      .get(now);

    if (!candidate) return null;

    const update = db
      .prepare(
        `UPDATE jobs SET status = 'running', lease_worker = ?, lease_until = ?, started_at = ?
       WHERE id = ? AND (status = 'pending' OR (status = 'failed' AND retries < max_retries AND (next_attempt_after IS NULL OR next_attempt_after <= ?)))`
      )
      .run(workerId, leaseUntil, now, candidate.id, now);

    if (update.changes !== 1) {
      return null;
    }

    const job = db
      .prepare(`SELECT * FROM jobs WHERE id = ? LIMIT 1`)
      .get(candidate.id);
    return job;
  });

  return tx();
};

const markJobDone = (jobId, result) => {
  const now = Date.now();
  db.prepare(
    `UPDATE jobs SET status = 'done', result = ?, finished_at = ?, lease_worker = NULL, lease_until = NULL
     WHERE id = ?`
  ).run(result ? JSON.stringify(result) : null, now, jobId);
};

const markJobProcessing = (jobId) => {
  const now = Date.now();
  db.prepare(
    `UPDATE jobs SET status = 'running', started_at = ?
     WHERE id = ?`
  ).run(Date.now(), jobId);
};

const markJobFailed = (
  jobId,
  errorMessage,
  retryDelayMs = 0,
  hardFail = false
) => {
  const now = Date.now();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE jobs SET retries = retries + 1, error = ?, finished_at = ?, lease_worker = NULL, lease_until = NULL WHERE id = ?`
    ).run(errorMessage, now, jobId);

    const info = db
      .prepare(`SELECT retries, max_retries FROM jobs WHERE id = ? LIMIT 1`)
      .get(jobId);
    if (!info) return null;

    const nextAttempt = retryDelayMs > 0 ? now + retryDelayMs : null;

    if (hardFail) {
      db.prepare(
        `UPDATE jobs SET status = 'dlq', next_attempt_after = NULL WHERE id = ?`
      ).run(jobId);
      return "dlq";
    } else {
      db.prepare(
        `UPDATE jobs SET status = 'failed', next_attempt_after = ? WHERE id = ?`
      ).run(nextAttempt, jobId);
      return "failed";
    }
  });

  return tx();
};

const runHandlerForJob = async (job) => {
  let handler;
  try {
    handler = TASK_HANDLERS[job.task_type];
    if (typeof handler !== "function") {
      throw new Error("Task handler must export a function");
    }
  } catch (e) {
    // handler missing => immediate DLQ
    const msg = `handler-missing: ${e.message}`;
    persistLog({
      ownerType: "job",
      ownerId: job.id,
      level: "error",
      message: msg,
    });
    markJobFailed(job.id, msg, 0, true);
    return;
  }

  // parse payload
  let payload = job.payload;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch (_) {
      /* leave as string */
    }
  }

  try {
    persistLog({
      ownerType: "job",
      ownerId: job.id,
      level: "info",
      message: `Worker ${WORKER_ID} started handler for job ${job.id} type ${job.task_type}`,
      meta: { payload },
    });
    markJobProcessing(job.id);

    // handler may be async
    const result = await handler({
      jobId: job.id,
      ownerId: job.owner_id,
      taskType: job.task_type,
      payload,
      workerId: WORKER_ID,
    });

    await sleep(2000); //for status change visibility on dashboard
    markJobDone(job.id, result);
    console.log(`job ${job.id} done`);
    persistLog({
      ownerType: "job",
      ownerId: job.id,
      level: "info",
      message: `handler processed succesfully`,
      meta: { result },
    });
  } catch (err) {
    const retries = Number(job.retries || 0);
    const base = 1000;
    const backoff = Math.min(60_000, base * 2 ** retries);
    const jitter = Math.floor(Math.random() * 1000);
    const retryDelay = backoff + jitter;

    const errMsg = err && err.message ? err.message : String(err);
    persistLog({
      ownerType: "job",
      ownerId: job.id,
      level: "error",
      message: `handler-error: ${errMsg}`,
      meta: { stack: err.stack },
    });

    const status = markJobFailed(job.id, errMsg, retryDelay);
    if (status === "dlq") {
      persistLog({
        ownerType: "job",
        ownerId: job.id,
        level: "error",
        message: "moved to dlq",
      });
    }
  }
};

let shuttingDown = false;
const mainLoop = async () => {
  initDb();
  db = getDb();
  TASK_HANDLERS = require("../handlers");
  console.log(
    `Worker processor ${WORKER_ID} started (lease=${LEASE_MS}ms poll=${POLL_MS}ms)`
  );
  persistLog({
    ownerType: "system",
    level: "info",
    message: `Worker processor ${WORKER_ID} started (lease=${LEASE_MS}ms poll=${POLL_MS}ms)`,
  });

  while (!shuttingDown) {
    try {
      const job = claimNextJob(WORKER_ID, LEASE_MS);
      if (!job) {
        await sleep(POLL_MS);
        continue;
      }

      await runHandlerForJob(job);
      await sleep(4000); //for status change visibility on dashboard
    } catch (err) {
      console.error("Worker processor loop error:", err);
      await sleep(1000);
    }
  }
};

const shutdown = () => {
  shuttingDown = true;
  console.log(`Worker ${WORKER_ID} shutting down`);
  persistLog({
    ownerType: "job",
    ownerId: job.id,
    level: "info",
    message: `Worker ${WORKER_ID} shutting down`,
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

mainLoop().then(() => console.log("Worker loop exited"));

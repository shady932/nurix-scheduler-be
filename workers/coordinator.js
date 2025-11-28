"use strict";

const { initDb, getDb } = require("../database");
const { persistLog } = require("../helpers");
const SWEEP_MS = Number(process.env.SWEEP_MS || 20000);
let db;

let running = true;

const reclaimExpiredLeases = () => {
  const now = Date.now();
  const tx = db.transaction(() => {
    const expired = db
      .prepare(
        `SELECT id, lease_worker FROM jobs WHERE status = 'running' AND lease_until IS NOT NULL AND lease_until <= ?`
      )
      .all(now);

    if (expired.length === 0) return 0;

    for (const row of expired) {
      db.prepare(
        `UPDATE jobs SET status = 'pending', lease_worker = NULL, lease_until = NULL WHERE id = ? AND status = 'running'`
      ).run(row.id);

      persistLog({
        ownerType: "job",
        ownerId: row.id,
        level: "warn",
        message: `lease expired; reclaimed by coordinator`,
      });
    }
    return expired.length;
  });

  return tx();
};

const movePermanentFailuresToDLQ = () => {
  const tx = db.transaction(() => {
    const rows = db
      .prepare(
        `SELECT id FROM jobs WHERE status = 'failed' AND retries >= max_retries`
      )
      .all();
    if (rows.length === 0) return 0;
    for (const r of rows) {
      db.prepare(`UPDATE jobs SET status = 'dlq' WHERE id = ?`).run(r.id);
      persistLog({
        ownerType: "job",
        ownerId: r.id,
        level: "error",
        message: "moved to dlq by coordinator",
      });
    }
    return rows.length;
  });
  return tx();
};

const reenableRetryableFailedJobs = () => {
  const now = Date.now();
  const tx = db.transaction(() => {
    const rows = db
      .prepare(
        `SELECT id FROM jobs WHERE status = 'failed' AND (next_attempt_after IS NOT NULL AND next_attempt_after <= ?)`
      )
      .all(now);
    if (rows.length === 0) return 0;
    for (const r of rows) {
      db.prepare(`UPDATE jobs SET status = 'pending' WHERE id = ?`).run(r.id);
      persistLog({
        ownerType: "job",
        ownerId: r.id,
        level: "info",
        message: "re-enabled for retry by coordinator",
      });
    }
    return rows.length;
  });
  return tx();
};

const requeueDlqOnce = (batchSize = 10) => {
  const now = Date.now();

  const tx = db.transaction(() => {
    const candidates = db
      .prepare(
        `
        SELECT id
        FROM jobs
        WHERE status = 'dlq' 
          AND COALESCE(dlq_redrives, 0) < 1
        ORDER BY created_at ASC
        LIMIT ?
      `
      )
      .all(batchSize);

    if (!candidates || candidates.length === 0) return 0;

    for (const row of candidates) {
      db.prepare(
        `
        UPDATE jobs
        SET
          status = 'pending',
          dlq_redrives = COALESCE(dlq_redrives, 0) + 1,
          error = NULL,
          finished_at = NULL,
          next_attempt_after = NULL,
          retries = 0
        WHERE id = ?
      `
      ).run(row.id);

      try {
        persistLog({
          ownerType: "job",
          ownerId: row.id,
          level: "info",
          message:
            "requeued from dlq by coordinator (dlq_redrives incremented)",
          meta: { requeued_at: now },
        });
      } catch (e) {
        console.error("persistLog failed while requeueing dlq job", row.id, e);
      }
    }

    return candidates.length;
  });

  return tx();
};

const loop = async () => {
  initDb();
  db = getDb();
  console.log();
  persistLog({
    ownerType: "worker",
    ownerId: 171,
    level: "info",
    message: `Coordinator started`,
  });

  while (running) {
    try {
      const reclaimed = reclaimExpiredLeases();
      const dlqd = movePermanentFailuresToDLQ();
      const reen = reenableRetryableFailedJobs();
      const requeued = requeueDlqOnce(5);

      if (reclaimed + dlqd + reen + requeued > 0) {
        console.log(
          `Coordinator sweep: reclaimed=${reclaimed}, dlq=${dlqd}, reenabled=${reen}, requeued=${requeued}`
        );
        persistLog({
          ownerType: "worker",
          ownerId: 171,
          level: "info",
          message: `Coordinator sweep: reclaimed=${reclaimed}, dlq=${dlqd}, reenabled=${reen}, requeued=${requeued}`,
          meta: {},
        });
      }

      await new Promise((r) => setTimeout(r, SWEEP_MS));
    } catch (err) {
      console.error("Coordinator loop error:", err);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
};

const stop = () => {
  running = false;
  console.log("Coordinator stopping...");
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

console.log("Coordinator started, sweeping every", SWEEP_MS, "ms");
loop();

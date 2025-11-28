const { getDb } = require("../database");
const { persistLog, validateTaskType } = require("../helpers");
const { randomUUID } = require("crypto");

class JobsService {
  constructor(db) {
    this.db = db || getDb();
  }

  scheduleJob = ({
    taskType,
    ownerId,
    payload,
    maxRetries = 3,
    jobHash = null,
  }) => {
    try {
      if (!validateTaskType(taskType)) {
        const error = new Error("Invalid Task Type");
        error.status = 400;
        throw error;
      }
      const jobId = randomUUID();
      const query = this.db.prepare(`
        INSERT INTO jobs (id, owner_id, task_type, payload, status, max_retries, created_at, job_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      query.run(
        jobId,
        ownerId,
        taskType,
        JSON.stringify(payload),
        "pending",
        maxRetries,
        Date.now(),
        jobHash
      );
      persistLog({
        ownerType: "user",
        ownerId,
        level: "info",
        message: `Job scheduled with id ${jobId}`,
        meta: { taskType, ownerId, payload },
      });
      return { jobId, status: "pending" };
    } catch (error) {
      console.log("Error in scheduleJob: ", error);
      throw error;
    }
  };

  getJobs = ({
    userId,
    userRole,
    jobId = null,
    cursor = null,
    limit,
    status = null,
  }) => {
    try {
      const normalize = (row) => {
        if (!row) return row;
        try {
          if (row.payload && typeof row.payload === "string") {
            row.payload = JSON.parse(row.payload);
          }
        } catch (e) {
          //ignore
        }
        try {
          if (row.result && typeof row.result === "string") {
            row.result = JSON.parse(row.result);
          }
        } catch (e) {
          //ignore
        }
        const ts = Number(row.created_at);
        if (!Number.isNaN(ts)) row.created_at_iso = new Date(ts).toISOString();
        return row;
      };

      if (jobId) {
        const row = this.db
          .prepare("SELECT * FROM jobs WHERE id = ? LIMIT 1")
          .get(jobId);
        if (!row) return { jobs: [], nextCursor: null };
        if (userRole !== "ADMIN" && String(row.owner_id) !== String(userId)) {
          const err = new Error("Not authorised to fetch this job");
          err.status = 403;
          throw err;
        }
        return { jobs: [normalize(row)], nextCursor: null };
      }

      const whereClauses = [];
      const params = [];

      if (userRole !== "ADMIN") {
        whereClauses.push("owner_id = ?");
        params.push(userId);
      }

      if (cursor) {
        whereClauses.push(`(
        created_at <= ?
      )`);
        params.push(cursor);
      }

      if (status) {
        whereClauses.push(`(
        status = ?
      )`);
        params.push(status);
      }

      const whereSql = whereClauses.length
        ? `WHERE ${whereClauses.join(" AND ")}`
        : "";

      const fetchLimit = limit + 1;
      params.push(fetchLimit);

      const sql = `
      SELECT *
      FROM jobs
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `;
      const rows = this.db.prepare(sql).all(...params) || [];

      let nextCursor = null;
      if (rows.length > limit) {
        const nextRow = rows[limit];
        nextCursor = nextRow.created_at;
        rows.splice(limit, 1);
      }

      const jobs = rows.map(normalize);

      return { jobs, nextCursor };
    } catch (error) {
      console.error("Error in getJobs: ", error);
      throw error;
    }
  };

  getReport = () => {
    try {
      const row = this.db
        .prepare(
          `
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS submitted,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS processing,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status = 'dlq' AND COALESCE(dlq_redrives, 0) > 0 THEN 1 ELSE 0 END)
          AS dlq_with_redrive,
        SUM(CASE WHEN status = 'dlq' AND COALESCE(dlq_redrives, 0) = 0 THEN 1 ELSE 0 END)
          AS dlq_without_redrive
      FROM jobs;`
        )
        .get();

      return {
        "submitted (pending)": row.submitted,
        processing: row.processing,
        done: row.done,
        failed: row.failed,
        "dlq with redrive": row.dlq_with_redrive,
        "dlq without redrive": row.dlq_without_redrive,
      };
    } catch (error) {
      console.log("Error in getReport ", error);
      throw error;
    }
  };
}

module.exports = JobsService;

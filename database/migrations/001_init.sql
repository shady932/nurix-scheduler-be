CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  payload TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','running','done','failed','dlq')) DEFAULT 'pending',
  lease_worker TEXT,
  lease_until INTEGER,
  retries INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  dlq_redrives INTEGER DEFAULT 0,
  next_attempt_after INTEGER,
  result TEXT,
  error TEXT,
  created_at INTEGER,
  started_at INTEGER,
  finished_at INTEGER,
  job_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_owner_status ON jobs (owner_id, status);

-- CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_owner_idempotency ON jobs (owner_id, job_hash) WHERE idempotency_key IS NOT NULL;

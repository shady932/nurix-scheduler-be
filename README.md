# Job Orchestration System (Node.js + SQLite + Workers)

A lightweight, production-style job orchestration engine built with **Node.js**, **Express**, **SQLite (better-sqlite3)**, and **multi-process workers**.  
Supports task scheduling, job execution, retries, DLQ handling, reporting, and rate-limited APIs with user roles.

---

## ✨ Features

### Job Lifecycle
- Schedule jobs with payload, retries, idempotency keys.
- Atomic job claiming using SQLite transactions.
- Lease-based job processing (lock expiry → automatic reclaim).
- Exponential backoff + jitter retry logic.
- Dead-Letter Queue (DLQ) with controlled redrive.
- Per-task handler execution (sleep, sendEmail, webhook, transform).

### Workers
- **Processor Workers:**  
  Claim and execute jobs sequentially using handlers.
- **Coordinator Leader:**  
  - Reclaim expired running jobs  
  - Retry eligible failed jobs  
  - Move permanently failed jobs to DLQ  
  - Redrive DLQ once (`dlq_redrives < 1`)

### Dashboard-Friendly Updates
Workers intentionally sleep between jobs so status transitions remain visible in the UI.

### API Server
- Express + Express-Validator
- Centralized error handler  
- User auth via `x-user-auth` header with role mapping
- Rate limiting (token bucket, per user/IP)
- Swagger/OpenAPI served under `/openapi.json`

### Database
- SQLite (**better-sqlite3**) — fully synchronous & crash-safe.
- Migrations (1_x.sql files auto-applied).
- Tables:
  - `jobs` (status, retries, DLQ, lease, timestamps)
  - `logs` (append-only audit)
  - `migrations`
  - (optional dumps table)

### Logging
`persistLog()` writes job/system logs into the `logs` table for auditing.

---

## 📦 Installation

```bash
npm install
cp sample.env .env
```

Ensure your `.env` contains:

```
PORT=8000
DB_PATH=./data/jobs.db
MIGRATE_ON_START=true
RL_CAPACITY=60
RL_WINDOW_MS=60000
```

---

## 🚀 Running the System

### Start API Server
```bash
npm run start:api
```

### Start Worker Processor(s)
```bash
npm run start:processor
# or multiple instances
pm2 start worker-processor.js -i 2
```

### Start Coordinator (single instance)
```bash
npm run start:coordinator
```

### PM2 Example
```jsonc
{
  "apps": [
    { "name": "api", "script": "server.js" },
    { "name": "coordinator", "script": "worker-coordinator.js" },
    { "name": "processor", "script": "worker-processor.js", "instances": 2 }
  ]
}
```

---

## 🧪 API Overview

### Schedule Job
```
POST /v1/jobs
Headers: x-user-auth: <uuid>
```

### List Jobs (with cursor pagination)
```
GET /v1/jobs?cursor=<token>&limit=10
```

### Get Job by ID
```
GET /v1/jobs/:id
```

### Get Aggregated Report
```
GET /v1/jobs/report
```

### Get Logs
```
GET /v1/logs
```

### Swagger/OpenAPI
```
GET /openapi.json
```

---

## 📊 Reporting & Dashboard Data

The `getReport()` service returns:

```json
{
  "counts": {
    "pending": { "sleep": 2, "sendEmail": 1 },
    "running": { "webhook": 1 },
    "done": { "transform": 3 },
    "failed": { "sleep": 1 },
    "dlq": { "sendEmail": 1 }
  },
  "totals": {
    "pending": 3,
    "running": 1,
    "done": 3,
    "failed": 1,
    "dlq": 1
  },
  "dlqItems": [ ... job rows ... ]
}
```

Perfect for dashboards or admin consoles.

---

## 🧩 Architecture Overview

```
+-----------------+         +--------------------+
|   API Server    |  --->   |  SQLite (WAL mode) |
|  (Express.js)   |         | jobs, logs tables  |
+-----------------+         +--------------------+
          |                            ^
          v                            |
+-----------------+   leases/retries   |
| Processor N     |   -----------------+
| claim & execute |
+-----------------+
          |
+-----------------+
| Coordinator     |
| reclaim + dlq   |
+-----------------+
```

---

## 🛠 Handlers (Task Workers)

Add new tasks under:

```
services/tasks/<taskType>.js
```

Each exports:

```js
module.exports = async function(job, ctx) {
  // job: { id, owner_id, task_type, payload }
  // ctx:  { db, workerId, persistLog }
};
```

This structure allows pluggable, clean domain logic per job type.

---

## 🧹 Cleanup

Delete DB + regenerate via migrations:

```bash
rm -rf data/jobs.db
npm run migrate
```

---

## 📄 Notes

- SQLite runs in **WAL mode**, safe for multiple worker processes.
- No async DB access → workers are deterministic and race-free.
- Uses leases instead of advisory locks for simple consensus.
- Suitable for production in small/medium workloads or local scheduling.
- Added a simple Postman collection for ease

---

## 📬 Author / Maintainer
Saswata Haldar

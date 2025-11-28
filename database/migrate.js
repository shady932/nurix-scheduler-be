"use strict";
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, "data", "scheduler.db");
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

const ensureDir = (p) => {
  const d = path.dirname(p);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
};

const run = () => {
  ensureDir(DB_PATH);
  const db = new Database(DB_PATH);
  try {
    db.exec(
      "CREATE TABLE IF NOT EXISTS migrations (filename TEXT PRIMARY KEY, applied_at INTEGER);"
    );

    const files = fs.existsSync(MIGRATIONS_DIR)
      ? fs
          .readdirSync(MIGRATIONS_DIR)
          .filter((f) => f.endsWith(".sql"))
          .sort()
      : [];

    const applied = new Set(
      db
        .prepare("SELECT filename FROM migrations")
        .all()
        .map((r) => r.filename)
    );

    for (const file of files) {
      if (applied.has(file)) {
        console.log("skip", file);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log("apply", file);
      const tx = db.transaction(() => {
        db.exec(sql);
        db.prepare(
          "INSERT INTO migrations (filename, applied_at) VALUES (?, ?)"
        ).run(file, Date.now());
      });
      tx();
      console.log("applied", file);
    }
  } finally {
    db.close();
  }
};

if (require.main === module) run();
module.exports = run;

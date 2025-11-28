const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, "data", "scheduler.db");

ensureDataDir = () => {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};
let db = null;

initDb = () => {
  ensureDataDir(DB_PATH);
  db = new Database(DB_PATH);
  try {
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
  } catch (e) {
    console.warn(
      "Warning: could not set pragmas on DB (maybe unsupported build):",
      e.message
    );
  }
  console.log(`API listening on DB: ${DB_PATH}`);
  return db;
};

getDb = () => {
  if (!db) throw new Error("DB not initialized");
  return db;
};

module.exports = { initDb, db, getDb };

const { getDb } = require("../database");

const TASK_TYPES = new Set([
  "sleep",
  "sendEmail",
  "webhook",
  "transform",
  "faliureTest",
]);

const persistLog = async ({ ownerType, ownerId, level, message, meta }) => {
  try {
    const db = getDb();
    const insertLog = db.prepare(`
    INSERT INTO logs (owner_type, owner_id, level, message, meta, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
    const ts = new Date().toISOString();
    const metaJson = meta ? JSON.stringify(meta) : null;

    insertLog.run(ownerType, ownerId, level, message, metaJson, ts);
    return true;
  } catch (error) {
    console.log("Error in persistLog: ", error);
    throw error;
  }
};

const validateTaskType = (taskType) => {
  return TASK_TYPES.has(taskType);
};

module.exports = { persistLog, validateTaskType };

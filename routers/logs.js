const express = require("express");
const router = express.Router();
const LogsController = require("../controllers/logs");

module.exports = (db) => {
  const logsController = new LogsController(db);
  router.get("/", logsController.getLogs);
  return router;
};

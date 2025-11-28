const express = require("express");
const router = express.Router();
const JobsController = require("../controllers/jobs");
const LogsController = require("../controllers/logs");

module.exports = (db) => {
  const jobsController = new JobsController(db);
  const logsController = new LogsController(db);

  router.get("/jobs", jobsController.getJobs);
  router.get("/jobs/report", jobsController.getReport);
  router.get("/logs", logsController.getLogs);

  return router;
};

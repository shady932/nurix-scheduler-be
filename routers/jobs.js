const express = require("express");
const router = express.Router();
const JobsController = require("../controllers/jobs");

module.exports = (db) => {
  const jobsController = new JobsController(db);
  router.post("/", jobsController.scheduleJob);
  router.get("/", jobsController.getJobs);
  return router;
};

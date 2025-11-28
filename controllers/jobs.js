const JobsService = require("../services/jobs");

class JobsController {
  constructor(db) {
    this.jobsService = new JobsService(db);
  }

  scheduleJob = (req, res, next) => {
    try {
      const { taskType, payload } = req.body;
      const response = this.jobsService.scheduleJob({
        taskType,
        ownerId: req.userId,
        payload,
      });
      res
        .status(200)
        .json({ data: response, message: "Job Scheduledd succesfully" });
    } catch (error) {
      next(error);
    }
  };

  getJobs = (req, res, next) => {
    try {
      const { cursor, limit, jobId, status } = req.query;
      const response = this.jobsService.getJobs({
        userId: req.userId,
        userRole: req.userRole,
        cursor,
        limit: parseInt(limit || 10),
        jobId,
        status,
      });
      res
        .status(200)
        .json({ data: response, message: "Jobs Fetched succesfully" });
    } catch (error) {
      next(error);
    }
  };

  getReport = (req, res, next) => {
    try {
      const response = this.jobsService.getReport({});
      res
        .status(200)
        .json({ data: response, message: "Report Fetched succesfully" });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = JobsController;

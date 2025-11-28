const LogsService = require("../services/logs");

class LogsController {
  constructor(db) {
    this.logsService = new LogsService(db);
  }

  getLogs = (req, res, next) => {
    try {
      console.log(req.userId);
      const response = this.logsService.getLogs();
      res
        .status(200)
        .json({ data: response, message: "Logs fetched succesfully" });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = LogsController;

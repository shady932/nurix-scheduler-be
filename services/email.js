const { getDb } = require("../database");

class EmailService {
  constructor(db) {
    this.db = db || getDb();
  }

  handler = ({ jobId, ownerId, taskType, payload, workerId }) => {
    try {
      console.log("Email handler running: ");
      console.log({ jobId, ownerId, taskType, payload, workerId });

      return payload;
    } catch (error) {
      console.log("Error in emailHandler: ", error);
      throw error;
    }
  };
}

module.exports = EmailService;

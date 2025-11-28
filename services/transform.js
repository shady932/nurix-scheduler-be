const { getDb } = require("../database");

class TransformService {
  constructor(db) {
    this.db = db || getDb();
  }

  handler = ({ jobId, ownerId, taskType, payload, workerId }) => {
    try {
      console.log("Transform handler running: ");
      console.log({ jobId, ownerId, taskType, payload, workerId });

      return payload;
    } catch (error) {
      console.log("Error in transformHandler: ", error);
      throw error;
    }
  };
}

module.exports = TransformService;

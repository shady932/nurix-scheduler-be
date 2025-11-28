const { getDb } = require("../database");

class WebhookService {
  constructor(db) {
    this.db = db || getDb();
  }

  handler = ({ jobId, ownerId, taskType, payload, workerId }) => {
    try {
      console.log("Webhook handler running: ");
      console.log({ jobId, ownerId, taskType, payload, workerId });

      return payload;
    } catch (error) {
      console.log("Error in webhookHandler: ", error);
      throw error;
    }
  };
}

module.exports = WebhookService;

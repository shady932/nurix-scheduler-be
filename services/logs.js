const { getDb } = require("../database");

class LogsService {
  constructor(db) {
    this.db = db || getDb();
  }

  getLogs = () => {
    try {
      const query = this.db.prepare(`SELECT * from logs order by id desc`);

      return query.all();
    } catch (error) {
      console.log("Error in getLogs: ", error);
      throw error;
    }
  };
}

module.exports = LogsService;

"use strict";

require("dotenv").config();
const { createApp } = require("./server");
const { initDb } = require("./database");
const migrate = require("./database/migrate");
const registerRoutes = require("./routers");
const PORT = Number(process.env.PORT || 8000);

async function main() {
  try {
    const db = initDb();

    if (process.env.MIGRATE_ON_START === "true") {
      migrate();
    }

    const app = createApp(db);

    registerRoutes(app, db);

    const { persistLog } = require("./helpers");

    const server = app.listen(PORT, () => {
      console.log(`API listening on port ${PORT}`);
      persistLog({
        ownerType: "system",
        level: "info",
        message: `API listening on port ${PORT}`,
        meta: {},
      });
    });

    // Graceful shutdown
    let shuttingDown = false;
    async function gracefulShutdown(signal) {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Received ${signal}. Shutting down gracefully...`);

      // Stop accepting new connections
      server.close((err) => {
        if (err) console.error("Error closing HTTP server:", err);
        else console.log("HTTP server closed.");
        persistLog({
          ownerType: "system",
          level: err ? "error" : "info",
          message: "HTTP server closed.",
          meta: err ? { error: err } : {},
        });
      });

      // Wait a short time for existing requests to finish, then close DB
      // Adjust timeout if you expect long-running requests.
      setTimeout(() => {
        try {
          if (db && typeof db.close === "function") {
            db.close();
            console.log("Database closed.");
          }
          process.exit(0);
        } catch (e) {
          console.error("Error while closing DB during shutdown:", e);
          process.exit(1);
        }
      }, 200);
    }

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

    // In case of uncaught exceptions/rejections, log and exit (so PM2/systemd can restart)
    process.on("uncaughtException", (err) => {
      console.error("uncaughtException, exiting:", err);
      process.exit(1);
    });
    process.on("unhandledRejection", (reason) => {
      console.error("unhandledRejection, exiting:", reason);
      process.exit(1);
    });
  } catch (err) {
    console.error("Failed to start application:", err);
    process.exit(1);
  }
}

main();

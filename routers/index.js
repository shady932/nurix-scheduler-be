const jobsRouter = require("./jobs");
const logsRouter = require("./logs");
const dashboardRouter = require("./dashboard");
const verifyUser = require("../middlewares/user");
const rateLimiter = require("../middlewares/rateLimiter");

const registerRoutes = (app, db) => {
  app.use(
    "/v1/jobs",
    verifyUser,
    rateLimiter({
      capacity: 5,
      windowMs: 60_000,
      adminBypass: true,
    }),
    jobsRouter(db)
  );
  app.use(
    "/v1/logs",
    verifyUser,
    rateLimiter({
      capacity: 5,
      windowMs: 60_000,
      adminBypass: true,
    }),
    logsRouter(db)
  );
  app.use("/v1/dashboard", verifyUser, dashboardRouter(db));
};

module.exports = registerRoutes;

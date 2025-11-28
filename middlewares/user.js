const USER_AUTH_MAP = {
  "9c5e4f6e-7604-4871-a3af-0fe4b23c5c7d": 1,
  "ee0a0d73-07d1-42de-93e3-e51accd363aa": 2,
  "29926445-fc26-44ec-b748-687a70f695d0": 3,
};
const USER_ROLE_MAP = {
  1: "ADMIN",
  2: "CLIENT",
  3: "CLIENT",
};

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers[`x-user-auth`] ?? null;
    if (!authHeader) {
      const err = new Error("Unauthenticated User");
      err.status = 403;
      next(err);
    }
    req.userId = USER_AUTH_MAP[authHeader];
    req.userRole = USER_ROLE_MAP[req.userId];
    next();
  } catch (error) {
    next(error);
  }
};

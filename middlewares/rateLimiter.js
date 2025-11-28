"use strict";

const DEFAULT_CAPACITY = Number(process.env.RL_CAPACITY || 60); // tokens
const DEFAULT_WINDOW_MS = Number(process.env.RL_WINDOW_MS || 60_000); // ms

module.exports = (opts = {}) => {
  const capacity = opts.capacity || DEFAULT_CAPACITY;
  const windowMs = opts.windowMs || DEFAULT_WINDOW_MS;
  const adminBypass = opts.adminBypass !== false;

  // refillRate: tokens per ms
  const refillRate = capacity / windowMs;
  const store = new Map();

  const nowMs = () => {
    return Date.now();
  };

  const getKey = (req) => {
    if (req && req.userId) return `u:${req.userId}`;
    const ip =
      (req &&
        (req.ip ||
          req.headers["x-forwarded-for"] ||
          req.connection.remoteAddress)) ||
      "anon";
    return `ip:${ip}`;
  };

  const refill = (bucket, now) => {
    if (!bucket) return null;
    const elapsed = Math.max(0, now - bucket.lastRefill);
    const add = elapsed * refillRate;
    bucket.tokens = Math.min(capacity, bucket.tokens + add);
    bucket.lastRefill = now;
    return bucket;
  };

  return (req, res, next) => {
    try {
      // allow admins through
      if (adminBypass && req && req.userRole === "ADMIN") {
        res.setHeader("X-RateLimit-Limit", capacity);
        res.setHeader("X-RateLimit-Remaining", "unlimited");
        return next();
      }

      const key = getKey(req);
      const now = nowMs();
      let bucket = store.get(key);

      if (!bucket) {
        bucket = { tokens: capacity, lastRefill: now };
        store.set(key, bucket);
      }

      refill(bucket, now);

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        // headers
        res.setHeader("X-RateLimit-Limit", capacity);
        res.setHeader("X-RateLimit-Remaining", Math.floor(bucket.tokens));
        return next();
      }

      const tokensNeeded = 1 - bucket.tokens;
      const retryAfterMs = Math.ceil(tokensNeeded / refillRate);
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);

      res.setHeader("Retry-After", String(retryAfterSec));
      res.setHeader("X-RateLimit-Limit", capacity);
      res.setHeader("X-RateLimit-Remaining", 0);

      res.status(429).json({
        ok: false,
        error: "rate_limited",
        message: `Rate limit exceeded. Retry after ${retryAfterSec} seconds.`,
        retryAfterSeconds: retryAfterSec,
      });
    } catch (err) {
      // on any error, allow request to proceed rather than block app
      console.error("rateLimiter middleware error", err);
      return next();
    }
  };
};

"use strict";

const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const createApp = (db) => {
  const app = express();

  app.use(
    cors({
      origin: "http://localhost:3000", // or "*"
      allowedHeaders: [
        "x-user-auth",
        "content-type",
        "Retry-After",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
      ],
      methods: ["GET", "POST"],
    })
  );
  app.use(helmet());
  app.use(bodyParser.json({ limit: "200kb" }));
  app.use(morgan("dev"));

  // Health
  app.get("/health", (req, res) => {
    try {
      const row = db.prepare("SELECT 1 as ok").get();
      return res.json({ status: "ok", db: !!row, ts: Date.now() });
    } catch (err) {
      return res
        .status(500)
        .json({ status: "error", db: false, error: String(err) });
    }
  });

  app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({
      ok: false,
      error: err.message,
      details: err.details || null,
    });
  });

  return app;
};

module.exports = { createApp };

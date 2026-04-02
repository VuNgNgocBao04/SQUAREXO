import cors from "cors";
import express, { type Express } from "express";
import type { AppEnv } from "../config/env";
import { metrics } from "../observability/metrics";

export function createApp(env: AppEnv): Express {
  const app = express();

  app.use(express.json());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
      credentials: true,
    }),
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      env: env.NODE_ENV,
      ts: new Date().toISOString(),
    });
  });

  app.get("/metrics", (_req, res) => {
    res.status(200).json(metrics.snapshot());
  });

  return app;
}

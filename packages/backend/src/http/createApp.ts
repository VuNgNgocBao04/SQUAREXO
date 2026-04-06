import cors from "cors";
import express, { type Express } from "express";
import type { AppEnv } from "../config/env";
import { metrics } from "../observability/metrics";
import { JwtTokenService } from "../services/authService";
import { createAuthRoutes } from "./authRoutes";
import { createAuthMiddleware } from "./authMiddleware";

export function createApp(env: AppEnv): Express {
  const app = express();
  const tokenService = new JwtTokenService(env);

  app.use(express.json());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
      credentials: true,
    }),
  );

  // Public routes
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

  // Auth routes (public except for /me which requires auth)
  const authMiddleware = createAuthMiddleware(tokenService);
  const authRoutes = createAuthRoutes(tokenService, authMiddleware);
  app.use("/api/auth", authRoutes);
  app.use("/api/protected", authMiddleware);

  // Export token service and auth middleware for use in server.ts
  (app as any).tokenService = tokenService;
  (app as any).authMiddleware = authMiddleware;

  return app;
}

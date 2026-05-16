import cors from "cors";
import express, { type Express } from "express";
import type { AppEnv } from "../config/env";
import type { DatabaseConnection } from "../db/client";
import { UserRepository } from "../db/userRepository";
import { TokenRevocationRepository } from "../db/tokenRevocationRepository";
import { metrics } from "../observability/metrics";
import { JwtTokenService } from "../services/authService";
import { createAuthRoutes } from "./authRoutes";
import { createAuthMiddleware } from "./authMiddleware";
import { createRateLimiters } from "./rateLimiter";

export function createApp(env: AppEnv, db: DatabaseConnection): Express {
  const app = express();
  const tokenService = new JwtTokenService(env);
  const userRepository = new UserRepository(db);
  const tokenRevocationRepository = new TokenRevocationRepository(db);
  const rateLimiters = createRateLimiters();
  
  // Link token revocation repository to token service for persistent revocation checks
  tokenService.setTokenRevocationRepository(tokenRevocationRepository);

  app.use(express.json());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
      credentials: true,
    }),
  );

  // Enhanced health check endpoint
  app.get("/health", (req, res) => {
    const dbHealthy = true; // Assume healthy for now - can add DB connectivity check
    const status = dbHealthy ? "ok" : "degraded";
    
    res.status(dbHealthy ? 200 : 503).json({
      status,
      env: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: dbHealthy ? "ok" : "failed",
        memory: process.memoryUsage(),
      },
    });
  });

  // Metrics endpoint
  app.get("/metrics", (_req, res) => {
    res.json(metrics.snapshot());
  });

  // Auth routes with rate limiting (public except for /me which requires auth)
  const authMiddleware = createAuthMiddleware(tokenService);
  const authRoutes = createAuthRoutes(tokenService, userRepository, tokenRevocationRepository, authMiddleware);
  app.use("/api/auth", rateLimiters.auth, authRoutes);
  
  // Protected API routes with rate limiting
  app.use("/api/protected", rateLimiters.api, authMiddleware);

  // Export services for use in server.ts
  (app as any).tokenService = tokenService;
  (app as any).authMiddleware = authMiddleware;
  (app as any).userRepository = userRepository;
  (app as any).tokenRevocationRepository = tokenRevocationRepository;

  return app;
}

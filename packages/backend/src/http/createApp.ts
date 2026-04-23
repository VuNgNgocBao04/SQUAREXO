import cors from "cors";
import express, { type Express } from "express";
import type { AppEnv } from "../config/env";
import { metrics } from "../observability/metrics";
import { JwtTokenService } from "../services/authService";
import { createAuthRoutes } from "./authRoutes";
import { createAuthMiddleware } from "./authMiddleware";
import { createUsersRouter } from "../routes/users";
import { createMatchesRouter } from "../routes/matches";
import { createHistoryRouter } from "../routes/history";
import { UserService } from "../services/userService";
import { MatchService } from "../services/matchService";
import { BlockchainService } from "../services/blockchainService";

export type CreatedApp = {
  app: Express;
  tokenService: JwtTokenService;
  matchService: MatchService;
  blockchainService: BlockchainService;
};

export function createApp(env: AppEnv): CreatedApp {
  const app = express();
  const tokenService = new JwtTokenService(env);
  const userService = new UserService();
  const matchService = new MatchService();
  const blockchainService = new BlockchainService(env);
  const corsOrigins = env.CORS_ORIGIN.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
  const corsOriginConfig =
    corsOrigins.includes("*") || corsOrigins.length === 0
      ? true
      : corsOrigins.length === 1
        ? corsOrigins[0]
        : corsOrigins;

  app.use(express.json({ limit: "1mb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    next();
  });
  app.use(
    cors({
      origin: corsOriginConfig,
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
  const usersRoutes = createUsersRouter(userService, matchService);
  const matchesRoutes = createMatchesRouter(matchService);
  const historyRoutes = createHistoryRouter(matchService, env.HISTORY_SYNC_API_KEY);

  app.use("/auth", authRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/history", historyRoutes);
  app.use("/api/protected", authMiddleware);
  app.use("/users", authMiddleware, usersRoutes);
  app.use("/matches", authMiddleware, matchesRoutes);

  return {
    app,
    tokenService,
    matchService,
    blockchainService,
  };
}

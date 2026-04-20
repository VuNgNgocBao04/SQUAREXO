import cors from "cors";
import express, { type Express } from "express";
import type { AppEnv } from "../config/env";
import { metrics } from "../observability/metrics";
import { JwtTokenService } from "../services/authService";
import { createAuthRoutes } from "./authRoutes";
import { createAuthMiddleware } from "./authMiddleware";
import { createUsersRouter } from "../routes/users";
import { createMatchesRouter } from "../routes/matches";
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
  const usersRoutes = createUsersRouter(userService, matchService);
  const matchesRoutes = createMatchesRouter(matchService);

  app.use("/auth", authRoutes);
  app.use("/api/auth", authRoutes);
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

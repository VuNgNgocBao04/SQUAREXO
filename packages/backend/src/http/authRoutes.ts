import type { RequestHandler } from "express";
import type { JwtTokenService } from "../services/authService";
import { UserService } from "../services/userService";
import { createAuthRouter } from "../routes/auth";

export function createAuthRoutes(tokenService: JwtTokenService, authMiddleware?: RequestHandler) {
  const userService = new UserService();
  return createAuthRouter(tokenService, userService, authMiddleware);
}

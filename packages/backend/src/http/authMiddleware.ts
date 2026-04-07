import type { Response, NextFunction } from "express";
import type { JwtTokenService } from "../services/authService";
import {
  createJwtAuthMiddleware,
  type AuthenticatedRequest,
} from "../middleware/auth";

export type { AuthenticatedRequest };

export function createAuthMiddleware(tokenService: JwtTokenService) {
  return createJwtAuthMiddleware(tokenService);
}

export function createOptionalAuthMiddleware(tokenService: JwtTokenService) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = tokenService.extractTokenFromHeader(authHeader);

    if (!token) {
      next();
      return;
    }

    const result = tokenService.verifyAccessToken(token);
    if (!result.error && result.payload) {
      req.user = {
        userId: result.payload.userId,
        username: result.payload.username,
        email: result.payload.email,
        role: result.payload.role,
        walletAddress: result.payload.walletAddress,
      };
      req.token = token;
    }

    next();
  };
}

import type { Request, Response, NextFunction } from "express";
import type { JwtTokenService } from "../services/authService";

/**
 * Extended Express Request with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    email: string;
    role: string;
    walletAddress?: string;
  };
  token?: string;
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(tokenService: JwtTokenService) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = tokenService.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        error: "Missing or invalid Authorization header",
        code: "MISSING_TOKEN",
      });
    }

    const payload = tokenService.verifyAccessToken(token);

    if (!payload) {
      return res.status(401).json({
        error: "Invalid or expired token",
        code: "INVALID_TOKEN",
      });
    }

    req.user = {
      userId: payload.userId,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      walletAddress: payload.walletAddress,
    };
    req.token = token;

    next();
  };
}

/**
 * Optional authentication middleware
 * Does not fail if token is missing, but validates if present
 */
export function createOptionalAuthMiddleware(tokenService: JwtTokenService) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = tokenService.extractTokenFromHeader(authHeader);

    if (token) {
      const payload = tokenService.verifyAccessToken(token);
      if (payload) {
        req.user = {
          userId: payload.userId,
          username: payload.username,
          email: payload.email,
          role: payload.role,
          walletAddress: payload.walletAddress,
        };
        req.token = token;
      }
    }

    next();
  };
}

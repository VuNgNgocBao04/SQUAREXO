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

    const result = tokenService.verifyAccessToken(token);

    if (result.error) {
      const statusCode = result.error === 'TOKEN_EXPIRED' ? 401 : 401;
      const errorMessage = result.error === 'TOKEN_EXPIRED' 
        ? "Token has expired" 
        : "Invalid or malformed token";
      
      return res.status(statusCode).json({
        error: errorMessage,
        code: result.error,
      });
    }

    const payload = result.payload;
    if (!payload) {
      return res.status(401).json({
        error: "Invalid or malformed token",
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
      const result = tokenService.verifyAccessToken(token);
      if (!result.error && result.payload) {
        const payload = result.payload;
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

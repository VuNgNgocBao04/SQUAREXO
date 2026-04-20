import type { Request, Response, NextFunction } from "express";
import type { JwtTokenService } from "../services/authService";

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

export function createJwtAuthMiddleware(tokenService: JwtTokenService) {
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
    if (result.error || !result.payload) {
      return res.status(401).json({
        error: result.error === "TOKEN_EXPIRED" ? "Token has expired" : "Invalid or malformed token",
        code: result.error ?? "INVALID_TOKEN",
      });
    }

    req.user = {
      userId: result.payload.userId,
      username: result.payload.username,
      email: result.payload.email,
      role: result.payload.role,
      walletAddress: result.payload.walletAddress,
    };
    req.token = token;

    return next();
  };
}

import jwt, { type SignOptions } from "jsonwebtoken";
import type { JwtPayload } from "../types/auth";
import type { AppEnv } from "../config/env";

/**
 * JWT Token Service
 * Handles signing and verifying JWT tokens
 */
export class JwtTokenService {
  private secret: string;
  private expiresIn: string;
  private refreshTokenExpiresIn: string;

  constructor(env: AppEnv) {
    this.secret = env.JWT_SECRET;
    this.expiresIn = env.JWT_EXPIRES_IN;
    this.refreshTokenExpiresIn = env.REFRESH_TOKEN_EXPIRES_IN;
  }

  /**
   * Sign an access token
   */
  signAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn as any,
      algorithm: "HS256",
    });
  }

  /**
   * Sign a refresh token
   */
  signRefreshToken(userId: string): string {
    return jwt.sign({ userId }, this.secret, {
      expiresIn: this.refreshTokenExpiresIn as any,
      algorithm: "HS256",
    });
  }

  /**
   * Verify an access token
   */
  verifyAccessToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
      });
      return decoded as JwtPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify a refresh token
   */
  verifyRefreshToken(token: string): { userId: string } | null {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
      });
      return decoded as { userId: string };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }
}

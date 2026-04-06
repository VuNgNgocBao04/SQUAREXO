import jwt, { type SignOptions, TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";
import type { JwtPayload, RefreshTokenPayload } from "../types/auth";
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
   * Sign an access token with tokenType claim
   */
  signAccessToken(payload: Omit<JwtPayload, 'tokenType'>): string {
    const fullPayload: JwtPayload = {
      ...payload,
      tokenType: 'access',
    };
    return jwt.sign(fullPayload, this.secret, {
      expiresIn: this.expiresIn as any,
      algorithm: "HS256",
    });
  }

  /**
   * Sign a refresh token with tokenType claim
   */
  signRefreshToken(userId: string): string {
    const payload: RefreshTokenPayload = {
      userId,
      tokenType: 'refresh',
    };
    return jwt.sign(payload, this.secret, {
      expiresIn: this.refreshTokenExpiresIn as any,
      algorithm: "HS256",
    });
  }

  /**
   * Verify an access token and validate tokenType
   */
  verifyAccessToken(token: string): { payload: JwtPayload | null; error?: string } {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
      }) as any;
      
      // Validate tokenType
      if (decoded.tokenType !== 'access') {
        return { payload: null, error: 'INVALID_TOKEN' };
      }
      
      return { payload: decoded as JwtPayload };
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        return { payload: null, error: 'TOKEN_EXPIRED' };
      } else if (error instanceof JsonWebTokenError) {
        return { payload: null, error: 'INVALID_TOKEN' };
      }
      return { payload: null, error: 'INVALID_TOKEN' };
    }
  }

  /**
   * Verify a refresh token and validate tokenType
   */
  verifyRefreshToken(token: string): { payload: RefreshTokenPayload | null; error?: string } {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
      }) as any;
      
      // Validate tokenType
      if (decoded.tokenType !== 'refresh') {
        return { payload: null, error: 'INVALID_TOKEN' };
      }
      
      return { payload: decoded as RefreshTokenPayload };
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        return { payload: null, error: 'TOKEN_EXPIRED' };
      } else if (error instanceof JsonWebTokenError) {
        return { payload: null, error: 'INVALID_TOKEN' };
      }
      return { payload: null, error: 'INVALID_TOKEN' };
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

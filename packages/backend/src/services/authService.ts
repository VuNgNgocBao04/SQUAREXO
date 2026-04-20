import jwt, { TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";
import { z } from "zod";
import { randomUUID } from "crypto";
import type { JwtPayload, RefreshTokenPayload } from "../types/auth";
import type { AppEnv } from "../config/env";

const accessPayloadSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  walletAddress: z.string().optional(),
  tokenType: z.literal("access"),
  jti: z.string().uuid(),
});

const refreshPayloadSchema = z.object({
  userId: z.string().min(1),
  tokenType: z.literal("refresh"),
  jti: z.string().uuid(),
});

/**
 * JWT Token Service
 * Handles signing and verifying JWT tokens
 */
export class JwtTokenService {
  private secret: string;
  private issuer: string;
  private audience: string;
  private expiresIn: string;
  private refreshTokenExpiresIn: string;
  private revokedRefreshTokens = new Set<string>();
  private activeRefreshTokenIds: Set<string> = new Set();
  private revokedRefreshTokenIds: Set<string> = new Set();

  constructor(env: AppEnv) {
    this.secret = env.JWT_SECRET;
    this.issuer = env.JWT_ISSUER;
    this.audience = env.JWT_AUDIENCE;
    this.expiresIn = env.JWT_EXPIRES_IN;
    this.refreshTokenExpiresIn = env.REFRESH_TOKEN_EXPIRES_IN;
  }

  /**
   * Sign an access token with tokenType claim
   */
  signAccessToken(payload: Omit<JwtPayload, "tokenType" | "jti" | "iss" | "aud">): string {
    const jti = randomUUID();
    const fullPayload = {
      ...payload,
      tokenType: "access",
    };
    return jwt.sign(fullPayload, this.secret, {
      expiresIn: this.expiresIn as any,
      algorithm: "HS256",
      issuer: this.issuer,
      audience: this.audience,
      jwtid: jti,
    });
  }

  /**
   * Sign a refresh token with tokenType claim
   */
  signRefreshToken(userId: string, rotateFromJti?: string): string {
    if (rotateFromJti) {
      this.activeRefreshTokenIds.delete(rotateFromJti);
      this.revokedRefreshTokenIds.add(rotateFromJti);
    }

    const jti = randomUUID();
    const payload: RefreshTokenPayload = {
      userId,
      tokenType: "refresh",
    };
    const token = jwt.sign(payload, this.secret, {
      expiresIn: this.refreshTokenExpiresIn as any,
      algorithm: "HS256",
      issuer: this.issuer,
      audience: this.audience,
      jwtid: jti,
    });

    this.activeRefreshTokenIds.add(jti);
    return token;
  }

  /**
   * Verify an access token and validate tokenType
   */
  verifyAccessToken(token: string): { payload: JwtPayload | null; error?: string } {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
        issuer: this.issuer,
        audience: this.audience,
      });

      const parsed = accessPayloadSchema.safeParse(decoded);
      if (!parsed.success) {
        return { payload: null, error: "INVALID_TOKEN" };
      }

      return { payload: parsed.data };
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        return { payload: null, error: "TOKEN_EXPIRED" };
      } else if (error instanceof JsonWebTokenError) {
        return { payload: null, error: "INVALID_TOKEN" };
      }
      return { payload: null, error: "INVALID_TOKEN" };
    }
  }

  /**
   * Verify a refresh token and validate tokenType
   */
  verifyRefreshToken(token: string): { payload: RefreshTokenPayload | null; error?: string } {
    if (this.revokedRefreshTokens.has(token)) {
      return { payload: null, error: "TOKEN_REVOKED" };
    }

    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
        issuer: this.issuer,
        audience: this.audience,
      });

      const parsed = refreshPayloadSchema.safeParse(decoded);
      if (!parsed.success) {
        return { payload: null, error: "INVALID_TOKEN" };
      }

      if (this.revokedRefreshTokenIds.has(parsed.data.jti) || !this.activeRefreshTokenIds.has(parsed.data.jti)) {
        return { payload: null, error: "TOKEN_REVOKED" };
      }

      return { payload: parsed.data };
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        return { payload: null, error: "TOKEN_EXPIRED" };
      } else if (error instanceof JsonWebTokenError) {
        return { payload: null, error: "INVALID_TOKEN" };
      }
      return { payload: null, error: "INVALID_TOKEN" };
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

  revokeRefreshToken(token: string): { revoked: boolean; error?: string } {
    if (this.revokedRefreshTokens.has(token)) {
      return { revoked: false, error: "TOKEN_REVOKED" };
    }

    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
        issuer: this.issuer,
        audience: this.audience,
      });

      const parsed = refreshPayloadSchema.safeParse(decoded);
      if (!parsed.success) {
        return { revoked: false, error: "INVALID_TOKEN" };
      }

      this.revokedRefreshTokens.add(token);
      this.activeRefreshTokenIds.delete(parsed.data.jti);
      this.revokedRefreshTokenIds.add(parsed.data.jti);
      return { revoked: true };
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        return { revoked: false, error: "TOKEN_EXPIRED" };
      }
      return { revoked: false, error: "INVALID_TOKEN" };
    }
  }
}

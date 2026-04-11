import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { z } from "zod";
import { ethers } from "ethers";
import type { JwtTokenService } from "../services/authService";
import type { UserService } from "../services/userService";
import type { AuthenticatedRequest } from "../middleware/auth";
import { UserStoreError } from "../store/userStore";

const registerSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(6).max(128),
  email: z.string().trim().toLowerCase().email().optional(),
  walletAddress: z
    .string()
    .trim()
    .refine((value) => ethers.isAddress(value), "walletAddress must be a valid EVM address")
    .optional(),
  avatarUrl: z.string().url().optional(),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(6).max(128),
}).refine((value) => !!(value.identifier || value.email), {
  message: "identifier or email is required",
  path: ["identifier"],
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export function createAuthRouter(
  tokenService: JwtTokenService,
  userService: UserService,
  authMiddleware?: RequestHandler,
) {
  const router = Router();

  router.post("/register", async (req: AuthenticatedRequest, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      });
    }

    const { username, password, walletAddress, avatarUrl } = parsed.data;
    const email = parsed.data.email ?? `${username.toLowerCase()}_${randomUUID()}@local.squarexo`;

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const user = await userService.createUser({
        username,
        email,
        passwordHash,
        walletAddress,
        avatarUrl,
      });

      const accessToken = tokenService.signAccessToken({
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
      });

      const refreshToken = tokenService.signRefreshToken(user.id);

      return res.status(201).json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          walletAddress: user.walletAddress,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof UserStoreError) {
        return res.status(409).json({
          error: "User already exists",
          code: "USER_EXISTS",
        });
      }

      return res.status(500).json({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  });

  router.post("/login", async (req: AuthenticatedRequest, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      });
    }

    const { password } = parsed.data;
    const identifier = parsed.data.identifier ?? parsed.data.email ?? "";
    const user = await userService.findByIdentifier(identifier);

    if (!user) {
      return res.status(401).json({
        error: "Invalid username/email or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({
        error: "Invalid username/email or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    const accessToken = tokenService.signAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      walletAddress: user.walletAddress,
    });

    const refreshToken = tokenService.signRefreshToken(user.id);

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  });

  router.post("/refresh", async (req: AuthenticatedRequest, res: Response) => {
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      });
    }

    const result = tokenService.verifyRefreshToken(parsed.data.refreshToken);
    if (result.error || !result.payload) {
      const code =
        result.error === "TOKEN_EXPIRED"
          ? "EXPIRED_REFRESH_TOKEN"
          : result.error === "TOKEN_REVOKED"
            ? "REVOKED_REFRESH_TOKEN"
            : "INVALID_REFRESH_TOKEN";
      return res.status(401).json({
        error: "Invalid or expired refresh token",
        code,
      });
    }

    const user = await userService.findById(result.payload.userId);
    if (!user) {
      return res.status(401).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    return res.status(200).json({
      accessToken: tokenService.signAccessToken({
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
      }),
      refreshToken: tokenService.signRefreshToken(user.id, result.payload.jti),
    });
  });

  router.post("/logout", async (req: AuthenticatedRequest, res: Response) => {
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      });
    }

    tokenService.revokeRefreshToken(parsed.data.refreshToken);
    return res.status(200).json({ success: true });
  });

  router.get(
    "/me",
    authMiddleware
      || ((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
          return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        return next();
      }),
    async (req: AuthenticatedRequest, res: Response) => {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
      }

      const user = await userService.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      }

      return res.status(200).json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    },
  );

  return router;
}

import { Router, type Response } from "express";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { registerSchema, loginSchema, refreshTokenSchema } from "../contracts/schemas";
import { userStore } from "../store/userStore";
import type { JwtTokenService } from "../services/authService";
import type { AuthenticatedRequest } from "./authMiddleware";
import type { User, AuthResponse } from "../types/auth";

/**
 * Create auth routes
 */
export function createAuthRoutes(tokenService: JwtTokenService) {
  const router = Router();

  /**
   * POST /auth/register
   * Register a new user and return access token
   */
  router.post("/register", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation error",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues,
        });
      }

      const { username, email, password, walletAddress } = parsed.data;

      // Check if user already exists
      if (userStore.findByEmail(email) || userStore.findByUsername(username)) {
        return res.status(409).json({
          error: "User already exists",
          code: "USER_EXISTS",
        });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const user: User = {
        id: randomUUID(),
        username,
        email,
        passwordHash,
        role: "user",
        walletAddress,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userStore.createUser(user);

      // Generate tokens
      const accessToken = tokenService.signAccessToken({
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
      });

      const refreshToken = tokenService.signRefreshToken(user.id);

      const response: AuthResponse = {
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          walletAddress: user.walletAddress,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };

      return res.status(201).json({
        ...response,
        refreshToken, // Include refresh token in response
      });
    } catch (error) {
      console.error("Register error:", error);
      return res.status(500).json({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  });

  /**
   * POST /auth/login
   * Login user and return access token
   */
  router.post("/login", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation error",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues,
        });
      }

      const { email, password } = parsed.data;

      // Find user by email
      const user = userStore.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          error: "Invalid email or password",
          code: "INVALID_CREDENTIALS",
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: "Invalid email or password",
          code: "INVALID_CREDENTIALS",
        });
      }

      // Generate tokens
      const accessToken = tokenService.signAccessToken({
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
      });

      const refreshToken = tokenService.signRefreshToken(user.id);

      const response: AuthResponse = {
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          walletAddress: user.walletAddress,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };

      return res.status(200).json({
        ...response,
        refreshToken, // Include refresh token in response
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  });

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  router.post("/refresh", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = refreshTokenSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation error",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues,
        });
      }

      const { refreshToken } = parsed.data;

      // Verify refresh token
      const payload = tokenService.verifyRefreshToken(refreshToken);
      if (!payload) {
        return res.status(401).json({
          error: "Invalid or expired refresh token",
          code: "INVALID_REFRESH_TOKEN",
        });
      }

      // Get user
      const user = userStore.findById(payload.userId);
      if (!user) {
        return res.status(401).json({
          error: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      // Generate new access token
      const accessToken = tokenService.signAccessToken({
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
      });

      return res.status(200).json({
        accessToken,
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      return res.status(500).json({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  });

  /**
   * GET /auth/me
   * Get current user information (requires auth)
   */
  router.get("/me", (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    }

    const user = userStore.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
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
  });

  return router;
}

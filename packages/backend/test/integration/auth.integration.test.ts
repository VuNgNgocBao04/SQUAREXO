import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import { randomUUID } from "crypto";
import { createAuthRoutes } from "../../src/http/authRoutes";
import { JwtTokenService } from "../../src/services/authService";
import { createAuthMiddleware } from "../../src/http/authMiddleware";
import { userStore } from "../../src/store/userStore";
import type { AppEnv } from "../../src/config/env";

describe("Auth API Routes", () => {
  let app: Express;
  let tokenService: JwtTokenService;

  const mockEnv: AppEnv = {
    PORT: 3000,
    CORS_ORIGIN: "*",
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-key-that-is-long-enough-for-testing",
    JWT_EXPIRES_IN: "7d",
    REFRESH_TOKEN_EXPIRES_IN: "30d",
    PUBLIC_BASE_URL: "http://localhost:3000",
    RECONNECT_TIMEOUT_MS: 30000,
    DEDUPE_WINDOW_MS: 15000,
    ROOM_SWEEP_INTERVAL_MS: 5000,
  };

  beforeEach(() => {
    // Clear user store before each test
    userStore.clear();

    // Create app and token service
    tokenService = new JwtTokenService(mockEnv);
    app = express();
    app.use(express.json());

    // Create auth middleware
    const authMiddleware = createAuthMiddleware(tokenService);

    // Mount auth routes with auth middleware
    const authRoutes = createAuthRoutes(tokenService, authMiddleware);
    app.use("/api/auth", authRoutes);

    // Mount protected route middleware for testing
    app.get("/api/protected/me", authMiddleware, (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      res.json({ user: req.user });
    });
  });

  afterEach(() => {
    userStore.clear();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user with valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          email: "test@example.com",
          password: "password123",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body.user).toEqual({
        id: expect.any(String),
        username: "testuser",
        email: "test@example.com",
        role: "user",
        walletAddress: undefined,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it("should register user with optional walletAddress", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          email: "test@example.com",
          password: "password123",
          walletAddress: "0x1234567890abcdef",
        });

      expect(res.status).toBe(201);
      expect(res.body.user.walletAddress).toBe("0x1234567890abcdef");
    });

    it("should reject duplicate email", async () => {
      // First registration
      await request(app).post("/api/auth/register").send({
        username: "testuser1",
        email: "test@example.com",
        password: "password123",
      });

      // Second registration with same email
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser2",
          email: "test@example.com",
          password: "password123",
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("USER_EXISTS");
    });

    it("should reject duplicate username", async () => {
      // First registration
      await request(app).post("/api/auth/register").send({
        username: "testuser",
        email: "test1@example.com",
        password: "password123",
      });

      // Second registration with same username
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          email: "test2@example.com",
          password: "password123",
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("USER_EXISTS");
    });

    it("should reject duplicate username with different casing", async () => {
      await request(app).post("/api/auth/register").send({
        username: "TestUser",
        email: "test1@example.com",
        password: "password123",
      });

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          email: "test2@example.com",
          password: "password123",
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("USER_EXISTS");
    });

    it("should validate required fields", async () => {
      const res = await request(app).post("/api/auth/register").send({
        username: "testuser",
        // missing email and password
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should validate email format", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          email: "invalid-email",
          password: "password123",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should validate password minimum length", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          email: "test@example.com",
          password: "short",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should validate username minimum length", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          username: "ab",
          email: "test@example.com",
          password: "password123",
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Create a test user
      await request(app).post("/api/auth/register").send({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });
    });

    it("should login with valid credentials", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body.user).toEqual({
        id: expect.any(String),
        username: "testuser",
        email: "test@example.com",
        role: "user",
        walletAddress: undefined,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it("should reject login with wrong password", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "wrongpassword",
      });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_CREDENTIALS");
    });

    it("should reject login with non-existent email", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "password123",
      });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_CREDENTIALS");
    });

    it("should validate required fields", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        // missing password
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/auth/refresh", () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Create a test user and get refresh token
      const res = await request(app).post("/api/auth/register").send({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });
      refreshToken = res.body.refreshToken;
    });

    it("should refresh access token with valid refresh token", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
    });

    it("should reject invalid refresh token", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-token" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_REFRESH_TOKEN");
    });

    it("should validate required fields", async () => {
      const res = await request(app).post("/api/auth/refresh").send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Authentication Middleware", () => {
    let accessToken: string;

    beforeEach(async () => {
      // Create a test user and get access token
      const res = await request(app).post("/api/auth/register").send({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });
      accessToken = res.body.accessToken;
    });

    it("should allow access to protected route with valid token", async () => {
      const res = await request(app)
        .get("/api/protected/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        userId: expect.any(String),
        username: "testuser",
        email: "test@example.com",
        role: "user",
        walletAddress: undefined,
      });
    });

    it("should reject access without token", async () => {
      const res = await request(app).get("/api/protected/me");

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("MISSING_TOKEN");
    });

    it("should reject access with invalid token", async () => {
      const res = await request(app)
        .get("/api/protected/me")
        .set("Authorization", "Bearer invalid-token");

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_TOKEN");
    });

    it("should reject access with malformed Authorization header", async () => {
      const res = await request(app)
        .get("/api/protected/me")
        .set("Authorization", "InvalidFormat token");

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("MISSING_TOKEN");
    });
  });

  describe("GET /api/auth/me - protected route with middleware", () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      // Create a test user and get access token
      const res = await request(app).post("/api/auth/register").send({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });
      accessToken = res.body.accessToken;
      userId = res.body.user.id;
    });

    it("should return current user info with valid access token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: userId,
        username: "testuser",
        email: "test@example.com",
        role: "user",
        walletAddress: undefined,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it("should reject /api/auth/me without token", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("MISSING_TOKEN");
    });

    it("should reject /api/auth/me with invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token");

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_TOKEN");
    });
  });

  describe("Token type validation - Critical Security Tests", () => {
    let accessToken: string;
    let refreshToken: string;
    beforeEach(async () => {
      // Register user to get tokens
      const res = await request(app).post("/api/auth/register").send({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it("should reject refresh token when used as access token in protected route", async () => {
      // Try to use refresh token with bearer to access protected endpoint
      const res = await request(app)
        .get("/api/protected/me")
        .set("Authorization", `Bearer ${refreshToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_TOKEN");
    });

    it("should reject access token when used as refresh token in refresh endpoint", async () => {
      // Try to use access token as refresh token
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: accessToken });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_REFRESH_TOKEN");
    });

    it("should reject /api/auth/me with refresh token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${refreshToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_TOKEN");
    });
  });
});

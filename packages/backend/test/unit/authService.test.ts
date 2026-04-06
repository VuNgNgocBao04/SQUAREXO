import { describe, it, expect } from "vitest";
import { JwtTokenService } from "../../src/services/authService";
import type { AppEnv } from "../../src/config/env";

describe("JwtTokenService", () => {
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

  const tokenService = new JwtTokenService(mockEnv);

  describe("signAccessToken", () => {
    it("should sign an access token with payload", () => {
      const payload = {
        userId: "user123",
        username: "testuser",
        email: "test@example.com",
        role: "user",
      };

      const token = tokenService.signAccessToken(payload);

      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("should include wallet address in token if provided", () => {
      const payload = {
        userId: "user123",
        username: "testuser",
        email: "test@example.com",
        role: "user",
        walletAddress: "0x1234567890abcdef",
      };

      const token = tokenService.signAccessToken(payload);
      const result = tokenService.verifyAccessToken(token);

      expect(result.error).toBeUndefined();
      expect(result.payload?.walletAddress).toBe("0x1234567890abcdef");
    });
  });

  describe("verifyAccessToken", () => {
    it("should verify a valid access token", () => {
      const payload = {
        userId: "user123",
        username: "testuser",
        email: "test@example.com",
        role: "user",
      };

      const token = tokenService.signAccessToken(payload);
      const result = tokenService.verifyAccessToken(token);

      expect(result.error).toBeUndefined();
      expect(result.payload).not.toBeNull();
      expect(result.payload?.userId).toBe("user123");
      expect(result.payload?.username).toBe("testuser");
      expect(result.payload?.email).toBe("test@example.com");
      expect(result.payload?.role).toBe("user");
      expect(result.payload?.tokenType).toBe("access");
    });

    it("should return error for invalid token", () => {
      const result = tokenService.verifyAccessToken("invalid-token");
      expect(result.error).toBe("INVALID_TOKEN");
      expect(result.payload).toBeNull();
    });

    it("should return error for malformed token", () => {
      const result = tokenService.verifyAccessToken("header.payload");
      expect(result.error).toBe("INVALID_TOKEN");
      expect(result.payload).toBeNull();
    });

    it("should return error for tampered token", () => {
      const payload = {
        userId: "user123",
        username: "testuser",
        email: "test@example.com",
        role: "user",
      };

      const token = tokenService.signAccessToken(payload);
      const tamperedToken = token.substring(0, token.length - 5) + "xxxxx";
      const result = tokenService.verifyAccessToken(tamperedToken);

      expect(result.error).toBe("INVALID_TOKEN");
      expect(result.payload).toBeNull();
    });

    it("should reject refresh token when verifying as access token", () => {
      const refreshToken = tokenService.signRefreshToken("user123");
      const result = tokenService.verifyAccessToken(refreshToken);

      expect(result.error).toBe("INVALID_TOKEN");
      expect(result.payload).toBeNull();
    });
  });

  describe("signRefreshToken", () => {
    it("should sign a refresh token with userId", () => {
      const token = tokenService.signRefreshToken("user123");

      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });
  });

  describe("verifyRefreshToken", () => {
    it("should verify a valid refresh token", () => {
      const token = tokenService.signRefreshToken("user123");
      const result = tokenService.verifyRefreshToken(token);

      expect(result.error).toBeUndefined();
      expect(result.payload).not.toBeNull();
      expect(result.payload?.userId).toBe("user123");
      expect(result.payload?.tokenType).toBe("refresh");
    });

    it("should return error for invalid refresh token", () => {
      const result = tokenService.verifyRefreshToken("invalid-token");
      expect(result.error).toBe("INVALID_TOKEN");
      expect(result.payload).toBeNull();
    });

    it("should reject access token when verifying as refresh token", () => {
      const payload = {
        userId: "user123",
        username: "testuser",
        email: "test@example.com",
        role: "user",
      };
      const accessToken = tokenService.signAccessToken(payload);
      const result = tokenService.verifyRefreshToken(accessToken);

      expect(result.error).toBe("INVALID_TOKEN");
      expect(result.payload).toBeNull();
    });
  });

  describe("extractTokenFromHeader", () => {
    it("should extract token from valid Authorization header", () => {
      const token = "valid-token-here";
      const header = `Bearer ${token}`;

      const extracted = tokenService.extractTokenFromHeader(header);

      expect(extracted).toBe(token);
    });

    it("should return null for missing Authorization header", () => {
      const extracted = tokenService.extractTokenFromHeader(undefined);
      expect(extracted).toBeNull();
    });

    it("should return null for empty Authorization header", () => {
      const extracted = tokenService.extractTokenFromHeader("");
      expect(extracted).toBeNull();
    });

    it("should return null for malformed Authorization header", () => {
      const extracted = tokenService.extractTokenFromHeader("InvalidFormat token");
      expect(extracted).toBeNull();
    });

    it("should return null if header does not start with Bearer", () => {
      const extracted = tokenService.extractTokenFromHeader("Basic token");
      expect(extracted).toBeNull();
    });

    it("should return null for header with too many parts", () => {
      const extracted = tokenService.extractTokenFromHeader(
        "Bearer token extra",
      );
      expect(extracted).toBeNull();
    });
  });
});

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
      const verified = tokenService.verifyAccessToken(token);

      expect(verified?.walletAddress).toBe("0x1234567890abcdef");
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
      const verified = tokenService.verifyAccessToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe("user123");
      expect(verified?.username).toBe("testuser");
      expect(verified?.email).toBe("test@example.com");
      expect(verified?.role).toBe("user");
    });

    it("should return null for invalid token", () => {
      const verified = tokenService.verifyAccessToken("invalid-token");
      expect(verified).toBeNull();
    });

    it("should return null for malformed token", () => {
      const verified = tokenService.verifyAccessToken("header.payload");
      expect(verified).toBeNull();
    });

    it("should return null for tampered token", () => {
      const payload = {
        userId: "user123",
        username: "testuser",
        email: "test@example.com",
        role: "user",
      };

      const token = tokenService.signAccessToken(payload);
      const tamperedToken = token.substring(0, token.length - 5) + "xxxxx";
      const verified = tokenService.verifyAccessToken(tamperedToken);

      expect(verified).toBeNull();
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
      const verified = tokenService.verifyRefreshToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe("user123");
    });

    it("should return null for invalid refresh token", () => {
      const verified = tokenService.verifyRefreshToken("invalid-token");
      expect(verified).toBeNull();
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

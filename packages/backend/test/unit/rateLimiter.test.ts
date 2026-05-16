import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { RateLimiter, createRateLimiters } from "../../src/http/rateLimiter";

describe("Rate Limiter", () => {
  describe("RateLimiter", () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      // Create a rate limiter: 5 requests per 1 second per IP
      rateLimiter = new RateLimiter(1000, 5);
    });

    it("allows requests within limit", () => {
      const middleware = rateLimiter.middleware();
      const mockReq = { ip: "192.168.1.1" } as Request;
      const mockRes = {} as Response;
      const mockNext = vi.fn();

      // Make 5 requests (at the limit)
      for (let i = 0; i < 5; i++) {
        middleware(mockReq, mockRes, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
    });

    it("rejects requests exceeding limit", () => {
      const middleware = rateLimiter.middleware();
      const mockReq = { ip: "192.168.1.2" } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as any as Response;
      const mockNext = vi.fn();

      // Make 6 requests (1 over the limit)
      for (let i = 0; i < 6; i++) {
        middleware(mockReq, mockRes, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Too many requests",
          code: "RATE_LIMIT_EXCEEDED",
        }),
      );
    });

    it("resets count after time window expires", async () => {
      // Create a rate limiter with 100ms window
      const shortLimiter = new RateLimiter(100, 2);
      const middleware = shortLimiter.middleware();
      const mockReq = { ip: "192.168.1.3" } as Request;
      const mockRes = {} as Response;
      const mockNext = vi.fn();

      // Make 2 requests
      middleware(mockReq, mockRes, mockNext);
      middleware(mockReq, mockRes, mockNext);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be able to make 2 more requests
      mockNext.mockClear();
      middleware(mockReq, mockRes, mockNext);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it("uses custom key generator", () => {
      const customLimiter = new RateLimiter(1000, 5, (req) => {
        return (req as any).userId || "anonymous";
      });

      const middleware = customLimiter.middleware();
      const mockReq1 = { userId: "user-1" } as any as Request;
      const mockReq2 = { userId: "user-2" } as any as Request;
      const mockRes = {} as Response;
      const mockNext = vi.fn();

      // 5 requests for user-1
      for (let i = 0; i < 5; i++) {
        middleware(mockReq1, mockRes, mockNext);
      }

      // Should still allow 5 for user-2 (separate bucket)
      for (let i = 0; i < 5; i++) {
        middleware(mockReq2, mockRes, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(10);
    });
  });

  describe("createRateLimiters", () => {
    it("creates auth and api limiters", () => {
      const limiters = createRateLimiters();

      expect(limiters.auth).toBeDefined();
      expect(limiters.api).toBeDefined();
      expect(typeof limiters.auth).toBe("function");
      expect(typeof limiters.api).toBe("function");
    });

    it("auth limiter is more restrictive than api limiter", () => {
      const limiters = createRateLimiters();
      const mockReq = { ip: "192.168.1.1" } as Request;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as any as Response;
      const mockNext = vi.fn();

      // Auth: 10 req/min - test with 11 requests
      for (let i = 0; i < 11; i++) {
        limiters.auth(mockReq, mockRes, mockNext);
      }
      const authStatus = mockRes.status.mock.calls.length > 0 ? mockRes.status.mock.calls[mockRes.status.mock.calls.length - 1][0] : 200;
      expect(authStatus).toBe(429); // Should hit limit

      // Reset mocks
      mockNext.mockClear();
      mockRes.status.mockClear();
      mockRes.json.mockClear();

      // API: 100 req/min - should not hit limit with 11 requests
      for (let i = 0; i < 11; i++) {
        limiters.api(mockReq, mockRes, mockNext);
      }
      const apiStatus = mockRes.status.mock.calls.length > 0 ? mockRes.status.mock.calls[mockRes.status.mock.calls.length - 1][0] : 200;
      expect(apiStatus).not.toBe(429); // Should not hit limit
    });
  });
});

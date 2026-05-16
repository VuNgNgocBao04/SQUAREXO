import type { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

/**
 * Simple in-memory rate limiter
 * For production, use Redis-backed rate limiter
 */
export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private maxRequests: number;
  private keyGenerator: (req: Request) => string;

  constructor(windowMs: number, maxRequests: number, keyGenerator?: (req: Request) => string) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.keyGenerator = keyGenerator || ((req) => req.ip || "unknown");

    // Cleanup expired entries every minute
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.resetAt < now) {
          this.store.delete(key);
        }
      }
    }, 60000);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.keyGenerator(req);
      const now = Date.now();
      let entry = this.store.get(key);

      if (!entry || entry.resetAt < now) {
        entry = {
          count: 1,
          resetAt: now + this.windowMs,
        };
        this.store.set(key, entry);
        next();
        return;
      }

      entry.count += 1;

      if (entry.count > this.maxRequests) {
        logger.warn("rate_limit_exceeded", {
          ip: key,
          limit: this.maxRequests,
          window: this.windowMs,
        });
        return res.status(429).json({
          error: "Too many requests",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        });
      }

      next();
    };
  }
}

/**
 * Create rate limiters for different endpoints
 */
export function createRateLimiters() {
  // Auth endpoints: 10 requests per minute
  const authLimiter = new RateLimiter(60000, 10, (req) => {
    return req.ip || "unknown";
  });

  // API endpoints: 100 requests per minute
  const apiLimiter = new RateLimiter(60000, 100, (req) => {
    return req.ip || "unknown";
  });

  // Socket events are rate-limited at the socket level in handler.ts

  return {
    auth: authLimiter.middleware(),
    api: apiLimiter.middleware(),
  };
}

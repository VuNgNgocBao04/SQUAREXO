import type { NextFunction, Request, Response } from "express";

type Bucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 15_000;
const MAX_REQUESTS_PER_WINDOW = 100;
const buckets = new Map<string, Bucket>();

function getClientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }

  return req.ip || "unknown";
}

function cleanupExpired(now: number): void {
  if (buckets.size <= 10_000) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function createIpRateLimitMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    cleanupExpired(now);

    const key = getClientKey(req);
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + WINDOW_MS,
      });
      next();
      return;
    }

    existing.count += 1;
    if (existing.count > MAX_REQUESTS_PER_WINDOW) {
      res.setHeader("Retry-After", String(Math.ceil((existing.resetAt - now) / 1000)));
      res.status(429).json({
        error: "Too many requests",
        code: "RATE_LIMITED",
      });
      return;
    }

    next();
  };
}

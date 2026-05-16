import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Response } from "express";
import { createOptionalAuthMiddleware } from "../../src/http/authMiddleware";
import type { JwtTokenService } from "../../src/services/authService";
import type { AuthenticatedRequest } from "../../src/http/authMiddleware";

function createReq(authHeader?: string): AuthenticatedRequest {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as AuthenticatedRequest;
}

function createRes(): Response {
  return {} as Response;
}

describe("createOptionalAuthMiddleware", () => {
  it("passes through when no token is provided", () => {
    const tokenService = {
      extractTokenFromHeader: vi.fn().mockReturnValue(null),
      verifyAccessToken: vi.fn(),
    } as unknown as JwtTokenService;
    const next = vi.fn<NextFunction>();
    const middleware = createOptionalAuthMiddleware(tokenService);
    const req = createReq();

    middleware(req, createRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
    expect(req.token).toBeUndefined();
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it("attaches user and token when a valid token is provided", () => {
    const tokenService = {
      extractTokenFromHeader: vi.fn().mockReturnValue("valid-token"),
      verifyAccessToken: vi.fn().mockReturnValue({
        payload: {
          userId: "user-1",
          username: "alice",
          email: "alice@example.com",
          role: "user",
          walletAddress: "0x1111111111111111111111111111111111111111",
          tokenType: "access",
        },
      }),
    } as unknown as JwtTokenService;
    const next = vi.fn<NextFunction>();
    const middleware = createOptionalAuthMiddleware(tokenService);
    const req = createReq("Bearer valid-token");

    middleware(req, createRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.token).toBe("valid-token");
    expect(req.user).toEqual({
      userId: "user-1",
      username: "alice",
      email: "alice@example.com",
      role: "user",
      walletAddress: "0x1111111111111111111111111111111111111111",
    });
  });

  it("ignores invalid tokens and still continues", () => {
    const tokenService = {
      extractTokenFromHeader: vi.fn().mockReturnValue("bad-token"),
      verifyAccessToken: vi.fn().mockReturnValue({
        payload: null,
        error: "INVALID_TOKEN",
      }),
    } as unknown as JwtTokenService;
    const next = vi.fn<NextFunction>();
    const middleware = createOptionalAuthMiddleware(tokenService);
    const req = createReq("Bearer bad-token");

    middleware(req, createRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
    expect(req.token).toBeUndefined();
  });
});

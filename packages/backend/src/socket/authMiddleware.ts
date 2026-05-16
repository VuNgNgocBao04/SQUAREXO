import type { Socket } from "socket.io";
import type { JwtPayload } from "../types/auth";
import type { JwtTokenService } from "../services/authService";
import { logger } from "../config/logger";

/**
 * Enhanced socket authentication middleware
 * - Validates JWT tokens at handshake
 * - Binds player identity from JWT claims
 * - Prevents unauthorized socket connections
 * - Logs security events
 */
export function createSocketAuthMiddleware(tokenService: JwtTokenService) {
  return (socket: Socket, next: Function) => {
    try {
      // Extract token from handshake
      const rawToken = socket.handshake.auth?.token;
      const authHeader = socket.handshake.headers.authorization;
      
      let token: string | null = null;
      if (typeof rawToken === "string" && rawToken.length > 0) {
        token = rawToken;
      } else if (typeof authHeader === "string") {
        const [scheme, bearerToken] = authHeader.split(" ");
        if (scheme === "Bearer" && bearerToken) {
          token = bearerToken;
        }
      }

      if (!token) {
        logger.warn("socket_auth_missing_token", { socketId: socket.id });
        next(new Error("MISSING_TOKEN"));
        return;
      }

      // Verify JWT token
      const verified = tokenService.verifyAccessToken(token);
      if (verified.error || !verified.payload) {
        logger.warn("socket_auth_invalid_token", {
          socketId: socket.id,
          error: verified.error,
        });
        next(new Error(verified.error ?? "INVALID_TOKEN"));
        return;
      }

      const payload = verified.payload;

      // Validate JWT payload structure
      if (!payload.userId || !payload.username || !payload.email) {
        logger.warn("socket_auth_invalid_payload", {
          socketId: socket.id,
          userId: payload.userId,
        });
        next(new Error("INVALID_PAYLOAD"));
        return;
      }

      // Bind user identity to socket
      socket.data.user = payload as JwtPayload;
      socket.data.authenticatedAt = Date.now();
      
      logger.debug("socket_authenticated", {
        socketId: socket.id,
        userId: payload.userId,
        username: payload.username,
      });

      next();
    } catch (error) {
      logger.error("socket_auth_error", {
        socketId: socket.id,
        error: error instanceof Error ? error.message : "unknown_error",
      });
      next(new Error("AUTH_FAILED"));
    }
  };
}

/**
 * Validate that a socket has a properly authenticated user
 * Throws if socket is not properly authenticated
 */
export function validateSocketAuth(socket: Socket): void {
  const user = (socket.data as { user?: any }).user;
  if (!user || !user.userId || !user.username) {
    throw new Error("Socket not properly authenticated");
  }
}

/**
 * Get authenticated user from socket, validating it exists
 */
export function getAuthenticatedUser(socket: Socket): JwtPayload {
  validateSocketAuth(socket);
  return (socket.data as { user: JwtPayload }).user;
}

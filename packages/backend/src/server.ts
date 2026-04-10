import { createServer } from "node:http";
import { Server as IOServer } from "socket.io";
import type { AppEnv } from "./config/env";
import { logger } from "./config/logger";
import { registerSocketHandlers } from "./socket/handler";
import { createApp } from "./http/createApp";
import { RoomManager } from "./room/roomManager";
import type { JwtPayload } from "./types/auth";
import type { JwtTokenService } from "./services/authService";

function extractSocketToken(rawAuthToken: unknown, authorizationHeader: string | string[] | undefined): string | null {
  if (typeof rawAuthToken === "string" && rawAuthToken.length > 0) {
    return rawAuthToken;
  }

  if (typeof authorizationHeader === "string") {
    const [scheme, token] = authorizationHeader.split(" ");
    if (scheme === "Bearer" && token) {
      return token;
    }
  }

  return null;
}

function buildGuestSocketUser(rawGuestId: unknown): JwtPayload | null {
  if (typeof rawGuestId !== "string") {
    return null;
  }

  const guestId = rawGuestId.trim();
  if (!guestId) {
    return null;
  }

  const safeGuest = guestId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!safeGuest) {
    return null;
  }

  return {
    userId: `guest_${safeGuest}`,
    username: `guest_${safeGuest}`,
    email: `guest_${safeGuest}@squarexo.local`,
    role: "guest",
    tokenType: "access",
  };
}

export type BackendServer = {
  io: IOServer;
  httpServer: ReturnType<typeof createServer>;
  close: () => Promise<void>;
};

export function createBackendServer(env: AppEnv): BackendServer {
  const app = createApp(env);
  const httpServer = createServer(app);
  const io = new IOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
      methods: ["GET", "POST"],
    },
  });

  const tokenService = (app as { tokenService?: JwtTokenService }).tokenService;
  if (!tokenService) {
    throw new Error("Token service is not available for socket authentication");
  }
  io.use((socket, next) => {
    const token = extractSocketToken(socket.handshake.auth?.token, socket.handshake.headers.authorization);

    if (token) {
      const verified = tokenService.verifyAccessToken(token);
      if (verified.error || !verified.payload) {
        next(new Error(verified.error ?? "INVALID_TOKEN"));
        return;
      }

      socket.data.user = verified.payload as JwtPayload;
      next();
      return;
    }

    const guestUser = buildGuestSocketUser(socket.handshake.auth?.playerId);
    if (!guestUser) {
      next(new Error("MISSING_TOKEN"));
      return;
    }

    socket.data.user = guestUser;
    next();
  });

  const roomManager = new RoomManager(env.RECONNECT_TIMEOUT_MS, env.DEDUPE_WINDOW_MS);
  const roomSweepTimer = setInterval(() => {
    roomManager.sweepExpired();
  }, env.ROOM_SWEEP_INTERVAL_MS);
  roomSweepTimer.unref();

  registerSocketHandlers(io, {
    roomManager,
    publicBaseUrl: env.PUBLIC_BASE_URL ?? `http://localhost:${env.PORT}`,
  });

  let closed = false;
  const close = async () => {
    if (closed) {
      return;
    }

    closed = true;
    clearInterval(roomSweepTimer);
    await io.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error && error.message !== "Server is not running.") {
          reject(error);
          return;
        }
        resolve();
      });
    });
  };

  return {
    io,
    httpServer,
    close,
  };
}

export async function startBackendServer(env: AppEnv): Promise<BackendServer> {
  const server = createBackendServer(env);

  await new Promise<void>((resolve) => {
    server.httpServer.listen(env.PORT, () => {
      logger.info("backend_started", { port: env.PORT });
      resolve();
    });
  });

  return server;
}

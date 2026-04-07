import { createServer } from "node:http";
import { Server as IOServer } from "socket.io";
import type { AppEnv } from "./config/env";
import { logger } from "./config/logger";
import { registerSocketHandlers } from "./socket/handler";
import { createApp } from "./http/createApp";
import { RoomManager } from "./room/roomManager";
import { JwtTokenService } from "./services/authService";

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

  const tokenService = new JwtTokenService(env);
  const roomManager = new RoomManager(env.RECONNECT_TIMEOUT_MS, env.DEDUPE_WINDOW_MS);
  const roomSweepTimer = setInterval(() => {
    roomManager.sweepExpired();
  }, env.ROOM_SWEEP_INTERVAL_MS);
  roomSweepTimer.unref();

  // Socket.io authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication token required"));
    }

    try {
      const result = tokenService.verifyAccessToken(token);
      if (!result.payload || result.error) {
        return next(new Error("Invalid authentication token"));
      }
      socket.data.userId = result.payload.userId;
      socket.data.username = result.payload.username;
      socket.data.email = result.payload.email;
      next();
    } catch (error) {
      logger.error("socket_auth_failed", {
        error: error instanceof Error ? error.message : "unknown_error",
      });
      next(new Error("Invalid authentication token"));
    }
  });

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

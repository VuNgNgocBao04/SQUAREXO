import { createServer } from "node:http";
import { Server as IOServer } from "socket.io";
import type { AppEnv } from "./config/env";
import { logger } from "./config/logger";
import { registerSocketHandlers } from "./socket/handler";
import { createApp } from "./http/createApp";
import { RoomManager } from "./room/roomManager";

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

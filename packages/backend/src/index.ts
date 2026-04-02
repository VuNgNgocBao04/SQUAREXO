import { loadEnv } from "./config/env";
import { logger } from "./config/logger";
import { startBackendServer } from "./server";

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const server = await startBackendServer(env);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info("graceful_shutdown_start", { signal });
    try {
      await server.close();
      logger.info("graceful_shutdown_done", { signal });
      process.exit(0);
    } catch (error) {
      logger.error("graceful_shutdown_failed", {
        signal,
        error: error instanceof Error ? error.message : "unknown_error",
      });
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void bootstrap().catch((error) => {
  logger.error("bootstrap_failed", {
    error: error instanceof Error ? error.message : "unknown_error",
  });
  process.exit(1);
});
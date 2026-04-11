import { AddressInfo } from "node:net";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppEnv } from "../../src/config/env";
import { createBackendServer } from "../../src/server";

describe("http integration", () => {
  const env: AppEnv = {
    PORT: 0,
    CORS_ORIGIN: "*",
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-key-that-is-long-enough-for-testing",
    JWT_ISSUER: "squarexo-test-suite",
    JWT_AUDIENCE: "squarexo-test-clients",
    JWT_EXPIRES_IN: "7d",
    REFRESH_TOKEN_EXPIRES_IN: "30d",
    REQUIRE_SOCKET_JWT: true,
    ALLOW_GUEST_SOCKET_IN_DEV: false,
    PUBLIC_BASE_URL: "http://localhost:0",
    RECONNECT_TIMEOUT_MS: 15000,
    DEDUPE_WINDOW_MS: 10000,
    ROOM_SWEEP_INTERVAL_MS: 1000,
    BLOCKCHAIN_SUBMIT_RETRY_MAX_ATTEMPTS: 2,
    BLOCKCHAIN_SUBMIT_BASE_DELAY_MS: 100,
    BLOCKCHAIN_TX_CONFIRMATIONS: 1,
    BLOCKCHAIN_SUBMIT_TIMEOUT_MS: 5000,
  };

  let server: ReturnType<typeof createBackendServer>;
  let baseUrl = "";

  beforeEach(async () => {
    server = createBackendServer(env);
    await new Promise<void>((resolve) => {
      server.httpServer.listen(0, () => resolve());
    });
    const address = server.httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await server.close();
  });

  it("returns health status", async () => {
    const response = await request(baseUrl).get("/health").expect(200);
    expect(response.body.status).toBe("ok");
    expect(response.body).toHaveProperty("ts");
  });

  it("returns metrics payload", async () => {
    const response = await request(baseUrl).get("/metrics").expect(200);
    expect(response.body).toHaveProperty("activeRooms");
    expect(response.body).toHaveProperty("activeSockets");
    expect(response.body).toHaveProperty("errorCount");
  });
});

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
    PUBLIC_BASE_URL: "http://localhost:0",
    RECONNECT_TIMEOUT_MS: 15000,
    DEDUPE_WINDOW_MS: 10000,
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
    expect(response.body.env).toBe("test");
  });

  it("returns metrics payload", async () => {
    const response = await request(baseUrl).get("/metrics").expect(200);
    expect(response.body).toHaveProperty("activeRooms");
    expect(response.body).toHaveProperty("activeSockets");
    expect(response.body).toHaveProperty("errorCount");
  });
});

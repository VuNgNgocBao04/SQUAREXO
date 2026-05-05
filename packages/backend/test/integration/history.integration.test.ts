import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { createHistoryRouter } from "../../src/routes/history";

describe("History API Routes", () => {
  it("returns wallet history with items and pagination", async () => {
    const matchService = {
      getWalletHistory: async () => ({
        items: [{ id: "match-1", roomId: "ROOM01" }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
      syncWalletHistory: async () => ({ upserted: 0 }),
    };

    const app = express();
    app.use(express.json());
    app.use("/api/history", createHistoryRouter(matchService as any));

    const res = await request(app).get("/api/history").query({
      wallet: "0x1111111111111111111111111111111111111111",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [{ id: "match-1", roomId: "ROOM01" }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("rejects sync requests with a missing API key when configured", async () => {
    const matchService = {
      getWalletHistory: async () => ({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
      syncWalletHistory: async () => ({ upserted: 0 }),
    };

    const app = express();
    app.use(express.json());
    app.use("/api/history", createHistoryRouter(matchService as any, "abcdefghijklmnopqrstuvwxyz"));

    const res = await request(app).post("/api/history/sync").send({
      wallet: "0x1111111111111111111111111111111111111111",
      items: [],
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_SYNC_KEY");
  });
});

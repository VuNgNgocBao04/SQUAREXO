import { AddressInfo } from "node:net";
import { io as ioClient, Socket } from "socket.io-client";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SocketEvents } from "../../src/contracts/events";
import { createBackendServer } from "../../src/server";
import type { AppEnv } from "../../src/config/env";

type WaitOptions<T> = {
  socket: Socket;
  event: string;
  timeoutMs?: number;
  predicate?: (payload: T) => boolean;
};

function waitEvent<T>({ socket, event, timeoutMs = 3000, predicate }: WaitOptions<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    const onEvent = (payload: T) => {
      if (predicate && !predicate(payload)) {
        return;
      }
      clearTimeout(timeout);
      socket.off(event, onEvent);
      resolve(payload);
    };

    socket.on(event, onEvent);
  });
}

function waitConnected(socket: Socket, timeoutMs = 3000): Promise<void> {
  if (socket.connected) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("connect", onConnect);
      reject(new Error("Timed out waiting for connect"));
    }, timeoutMs);

    const onConnect = () => {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      resolve();
    };

    socket.on("connect", onConnect);
  });
}

async function registerAndGetAccessToken(baseUrl: string, suffix: string): Promise<string> {
  const response = await request(baseUrl)
    .post("/api/auth/register")
    .send({
      username: `socket_user_${suffix}`,
      email: `socket_${suffix}@example.com`,
      password: "password123",
    });

  expect(response.status).toBe(201);
  expect(response.body).toHaveProperty("accessToken");
  return response.body.accessToken as string;
}

function createAuthenticatedSocket(baseUrl: string, accessToken: string): Socket {
  return ioClient(baseUrl, {
    transports: ["websocket"],
    auth: {
      token: accessToken,
    },
  });
}

describe("socket integration", () => {
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

  let baseUrl = "";
  let server: ReturnType<typeof createBackendServer>;

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

  it("rejects socket connection without access token", async () => {
    const client = ioClient(baseUrl, {
      transports: ["websocket"],
      timeout: 1000,
    });

    try {
      const connectError = await waitEvent<Error>({
        socket: client,
        event: "connect_error",
      });
      expect(connectError.message).toBe("MISSING_TOKEN");
    } finally {
      client.disconnect();
    }
  });

  it("allows two clients to join and play one valid move", async () => {
    const token1 = await registerAndGetAccessToken(baseUrl, "match_1");
    const token2 = await registerAndGetAccessToken(baseUrl, "match_2");
    const c1 = createAuthenticatedSocket(baseUrl, token1);
    const c2 = createAuthenticatedSocket(baseUrl, token2);

    try {
      await Promise.all([waitConnected(c1), waitConnected(c2)]);

      const roomInfo1Promise = waitEvent<any>({
        socket: c1,
        event: SocketEvents.ROOM_INFO,
        predicate: (payload) => payload.roomId === "room_match",
      });
      const roomInfo2Promise = waitEvent<any>({
        socket: c2,
        event: SocketEvents.ROOM_INFO,
        predicate: (payload) => payload.roomId === "room_match",
      });

      c1.emit(SocketEvents.JOIN_ROOM, { roomId: "room_match", rows: 2, cols: 2 });
      c2.emit(SocketEvents.JOIN_ROOM, { roomId: "room_match", rows: 2, cols: 2 });

      const [roomInfo1, roomInfo2] = await Promise.all([roomInfo1Promise, roomInfo2Promise]);

      expect([roomInfo1.assignedPlayer, roomInfo2.assignedPlayer].sort()).toEqual(["O", "X"]);

      const xClient = roomInfo1.assignedPlayer === "X" ? c1 : c2;
      const statePromise = waitEvent<any>({
        socket: c1,
        event: SocketEvents.GAME_STATE,
        predicate: (payload) => payload.roomId === "room_match" && payload.state.edges.some((e: any) => e.takenBy),
      });
      xClient.emit(SocketEvents.MAKE_MOVE, {
        roomId: "room_match",
        actionId: "move-1",
        edge: {
          from: { row: 0, col: 0 },
          to: { row: 0, col: 1 },
        },
      });

      const state = await statePromise;
      expect(state.currentPlayer).toBe("O");
    } finally {
      c1.disconnect();
      c2.disconnect();
    }
  });

  it("returns validation error for bad payload without crashing", async () => {
    const token = await registerAndGetAccessToken(baseUrl, "validation_1");
    const client = createAuthenticatedSocket(baseUrl, token);

    try {
      await waitConnected(client);

      const errorPromise = waitEvent<any>({ socket: client, event: SocketEvents.ERROR });
      client.emit(SocketEvents.JOIN_ROOM, { roomId: "***", rows: 999, cols: 999 });
      const error = await errorPromise;

      expect(error.code).toBe("VALIDATION_ERROR");

      const roomInfoPromise = waitEvent<any>({
        socket: client,
        event: SocketEvents.ROOM_INFO,
        predicate: (payload) => payload.roomId === "room_ok",
      });
      client.emit(SocketEvents.JOIN_ROOM, { roomId: "room_ok", rows: 2, cols: 2 });
      const roomInfo = await roomInfoPromise;
      expect(roomInfo.roomId).toBe("room_ok");
    } finally {
      client.disconnect();
    }
  });

  it("deduplicates make_move by actionId", async () => {
    const token = await registerAndGetAccessToken(baseUrl, "dedupe_1");
    const client = createAuthenticatedSocket(baseUrl, token);

    try {
      await waitConnected(client);

      const roomInfoPromise = waitEvent<any>({
        socket: client,
        event: SocketEvents.ROOM_INFO,
        predicate: (payload) => payload.roomId === "room_dedupe",
      });
      client.emit(SocketEvents.JOIN_ROOM, { roomId: "room_dedupe", rows: 2, cols: 2 });
      await roomInfoPromise;

      const payload = {
        roomId: "room_dedupe",
        actionId: "dup-1",
        edge: { from: { row: 0, col: 0 }, to: { row: 0, col: 1 } },
      };

      const firstPromise = waitEvent<any>({
        socket: client,
        event: SocketEvents.GAME_STATE,
        predicate: (s) => s.roomId === "room_dedupe" && s.state.edges.some((e: any) => e.takenBy),
      });
      client.emit(SocketEvents.MAKE_MOVE, payload);
      const first = await firstPromise;

      const secondPromise = waitEvent<any>({
        socket: client,
        event: SocketEvents.GAME_STATE,
        predicate: (s) => s.roomId === "room_dedupe",
      });
      client.emit(SocketEvents.MAKE_MOVE, payload);
      const second = await secondPromise;

      expect(first.state.score).toEqual(second.state.score);
      expect(first.state.edges).toEqual(second.state.edges);
    } finally {
      client.disconnect();
    }
  });

  it("rejects duplicate or out-of-order client sequence", async () => {
    const token = await registerAndGetAccessToken(baseUrl, "sequence_1");
    const client = createAuthenticatedSocket(baseUrl, token);

    try {
      await waitConnected(client);

      const roomInfoPromise = waitEvent<any>({
        socket: client,
        event: SocketEvents.ROOM_INFO,
        predicate: (payload) => payload.roomId === "room_sequence_guard",
      });
      client.emit(SocketEvents.JOIN_ROOM, {
        roomId: "room_sequence_guard",
        rows: 2,
        cols: 2,
      });
      await roomInfoPromise;

      const firstStatePromise = waitEvent<any>({
        socket: client,
        event: SocketEvents.GAME_STATE,
        predicate: (s) => s.roomId === "room_sequence_guard" && s.state.edges.some((e: any) => e.takenBy),
      });
      client.emit(SocketEvents.MAKE_MOVE, {
        roomId: "room_sequence_guard",
        actionId: "seq-1",
        clientSequence: 1,
        edge: { from: { row: 0, col: 0 }, to: { row: 0, col: 1 } },
      });
      await firstStatePromise;

      const errorPromise = waitEvent<any>({ socket: client, event: SocketEvents.ERROR });
      client.emit(SocketEvents.MAKE_MOVE, {
        roomId: "room_sequence_guard",
        actionId: "seq-2",
        clientSequence: 1,
        edge: { from: { row: 1, col: 0 }, to: { row: 1, col: 1 } },
      });

      const error = await errorPromise;
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.message).toContain("out-of-order client sequence");
    } finally {
      client.disconnect();
    }
  });

  it("rate-limits rapid make_move events per socket", async () => {
    const token = await registerAndGetAccessToken(baseUrl, "ratelimit_1");
    const client = createAuthenticatedSocket(baseUrl, token);

    try {
      await waitConnected(client);

      const roomInfoPromise = waitEvent<any>({
        socket: client,
        event: SocketEvents.ROOM_INFO,
        predicate: (payload) => payload.roomId === "room_rate_limit",
      });
      client.emit(SocketEvents.JOIN_ROOM, {
        roomId: "room_rate_limit",
        rows: 2,
        cols: 2,
      });
      await roomInfoPromise;

      const thirdErrorPromise = waitEvent<any>({
        socket: client,
        event: SocketEvents.ERROR,
        predicate: (payload) =>
          payload.code === "VALIDATION_ERROR" &&
          typeof payload.message === "string" &&
          payload.message.includes("Too many moves"),
      });

      client.emit(SocketEvents.MAKE_MOVE, {
        roomId: "room_rate_limit",
        actionId: "rl-1",
        edge: { from: { row: 0, col: 0 }, to: { row: 0, col: 1 } },
      });
      client.emit(SocketEvents.MAKE_MOVE, {
        roomId: "room_rate_limit",
        actionId: "rl-2",
        edge: { from: { row: 1, col: 0 }, to: { row: 1, col: 1 } },
      });
      client.emit(SocketEvents.MAKE_MOVE, {
        roomId: "room_rate_limit",
        actionId: "rl-3",
        edge: { from: { row: 0, col: 0 }, to: { row: 1, col: 0 } },
      });

      const error = await thirdErrorPromise;
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.message).toContain("Too many moves");
    } finally {
      client.disconnect();
    }
  });

  it("rejects join_room when requested board size mismatches existing room", async () => {
    const token1 = await registerAndGetAccessToken(baseUrl, "sizeguard_1");
    const token2 = await registerAndGetAccessToken(baseUrl, "sizeguard_2");
    const c1 = createAuthenticatedSocket(baseUrl, token1);
    const c2 = createAuthenticatedSocket(baseUrl, token2);

    try {
      await Promise.all([waitConnected(c1), waitConnected(c2)]);

      const roomInfoPromise = waitEvent<any>({
        socket: c1,
        event: SocketEvents.ROOM_INFO,
        predicate: (payload) => payload.roomId === "room_size_guard",
      });
      c1.emit(SocketEvents.JOIN_ROOM, { roomId: "room_size_guard", rows: 2, cols: 2 });
      await roomInfoPromise;

      const errorPromise = waitEvent<any>({ socket: c2, event: SocketEvents.ERROR });
      c2.emit(SocketEvents.JOIN_ROOM, { roomId: "room_size_guard", rows: 3, cols: 2 });
      const error = await errorPromise;

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.message).toContain("board size");
    } finally {
      c1.disconnect();
      c2.disconnect();
    }
  });

  it("releases previous room slot immediately when switching rooms", async () => {
    const token1 = await registerAndGetAccessToken(baseUrl, "switch_1");
    const token2 = await registerAndGetAccessToken(baseUrl, "switch_2");
    const token3 = await registerAndGetAccessToken(baseUrl, "switch_3");
    const c1 = createAuthenticatedSocket(baseUrl, token1);
    const c2 = createAuthenticatedSocket(baseUrl, token2);
    const c3 = createAuthenticatedSocket(baseUrl, token3);

    try {
      await Promise.all([waitConnected(c1), waitConnected(c2), waitConnected(c3)]);

      const oldInfo1 = waitEvent<any>({
        socket: c1,
        event: SocketEvents.ROOM_INFO,
        predicate: (payload) => payload.roomId === "room_old",
      });
      const oldInfo2 = waitEvent<any>({
        socket: c2,
        event: SocketEvents.ROOM_INFO,
        predicate: (payload) => payload.roomId === "room_old",
      });

      c1.emit(SocketEvents.JOIN_ROOM, { roomId: "room_old", rows: 2, cols: 2 });
      c2.emit(SocketEvents.JOIN_ROOM, { roomId: "room_old", rows: 2, cols: 2 });

      await Promise.all([oldInfo1, oldInfo2]);

      const newRoomJoin = waitEvent<any>({
        socket: c1,
        event: SocketEvents.ROOM_INFO,
        predicate: (payload) => payload.roomId === "room_new",
      });
      c1.emit(SocketEvents.JOIN_ROOM, { roomId: "room_new", rows: 2, cols: 2 });
      await newRoomJoin;

      const reclaimed = waitEvent<any>({
        socket: c3,
        event: SocketEvents.ROOM_INFO,
        predicate: (payload) => payload.roomId === "room_old",
      });
      c3.emit(SocketEvents.JOIN_ROOM, { roomId: "room_old", rows: 2, cols: 2 });
      const reclaimedInfo = await reclaimed;

      expect(reclaimedInfo.assignedPlayer).toBe("X");
    } finally {
      c1.disconnect();
      c2.disconnect();
      c3.disconnect();
    }
  });

  it("plays full 1x1 match with two clients", async () => {
    const token1 = await registerAndGetAccessToken(baseUrl, "fullmatch_1");
    const token2 = await registerAndGetAccessToken(baseUrl, "fullmatch_2");
    const c1 = createAuthenticatedSocket(baseUrl, token1);
    const c2 = createAuthenticatedSocket(baseUrl, token2);

    try {
      await Promise.all([waitConnected(c1), waitConnected(c2)]);

      const info1Promise = waitEvent<any>({
        socket: c1,
        event: SocketEvents.ROOM_INFO,
        predicate: (payload) => payload.roomId === "room_full_match",
      });
      const info2Promise = waitEvent<any>({
        socket: c2,
        event: SocketEvents.ROOM_INFO,
        predicate: (payload) => payload.roomId === "room_full_match",
      });

      c1.emit(SocketEvents.JOIN_ROOM, { roomId: "room_full_match", rows: 1, cols: 1 });
      c2.emit(SocketEvents.JOIN_ROOM, { roomId: "room_full_match", rows: 1, cols: 1 });

      const [info1, info2] = await Promise.all([info1Promise, info2Promise]);
      const byPlayer: Record<string, Socket> = {
        [info1.assignedPlayer]: c1,
        [info2.assignedPlayer]: c2,
      };

      const edges = [
        { from: { row: 0, col: 0 }, to: { row: 0, col: 1 } },
        { from: { row: 0, col: 0 }, to: { row: 1, col: 0 } },
        { from: { row: 1, col: 0 }, to: { row: 1, col: 1 } },
        { from: { row: 0, col: 1 }, to: { row: 1, col: 1 } },
      ];

      let latestState: any = null;
      for (let i = 0; i < edges.length; i += 1) {
        const statePromise = waitEvent<any>({
          socket: c1,
          event: SocketEvents.GAME_STATE,
          predicate: (payload) => payload.roomId === "room_full_match" && payload.state.edges.some((e: any) => e.takenBy),
        });

        const currentPlayer = latestState?.currentPlayer ?? "X";
        byPlayer[currentPlayer].emit(SocketEvents.MAKE_MOVE, {
          roomId: "room_full_match",
          actionId: `full-${i}`,
          edge: edges[i],
        });

        latestState = await statePromise;
      }

      expect(latestState.state.score.X + latestState.state.score.O).toBe(1);
      expect(latestState.state.edges.filter((e: any) => !!e.takenBy)).toHaveLength(4);
    } finally {
      c1.disconnect();
      c2.disconnect();
    }
  });
});

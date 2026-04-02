import { AddressInfo } from "node:net";
import { io as ioClient, Socket } from "socket.io-client";
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

describe("socket integration", () => {
  const env: AppEnv = {
    PORT: 0,
    CORS_ORIGIN: "*",
    NODE_ENV: "test",
    PUBLIC_BASE_URL: "http://localhost:0",
    RECONNECT_TIMEOUT_MS: 15000,
    DEDUPE_WINDOW_MS: 10000,
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

  it("allows two clients to join and play one valid move", async () => {
    const c1 = ioClient(baseUrl, { transports: ["websocket"] });
    const c2 = ioClient(baseUrl, { transports: ["websocket"] });

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

      c1.emit(SocketEvents.JOIN_ROOM, { roomId: "room_match", rows: 2, cols: 2, playerId: "p1" });
      c2.emit(SocketEvents.JOIN_ROOM, { roomId: "room_match", rows: 2, cols: 2, playerId: "p2" });

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
    const client = ioClient(baseUrl, { transports: ["websocket"] });

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
      client.emit(SocketEvents.JOIN_ROOM, { roomId: "room_ok", rows: 2, cols: 2, playerId: "p1" });
      const roomInfo = await roomInfoPromise;
      expect(roomInfo.roomId).toBe("room_ok");
    } finally {
      client.disconnect();
    }
  });

  it("deduplicates make_move by actionId", async () => {
    const client = ioClient(baseUrl, { transports: ["websocket"] });

    try {
      await waitConnected(client);

      const roomInfoPromise = waitEvent<any>({
        socket: client,
        event: SocketEvents.ROOM_INFO,
        predicate: (payload) => payload.roomId === "room_dedupe",
      });
      client.emit(SocketEvents.JOIN_ROOM, { roomId: "room_dedupe", rows: 2, cols: 2, playerId: "p1" });
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

  it("plays full 1x1 match with two clients", async () => {
    const c1 = ioClient(baseUrl, { transports: ["websocket"] });
    const c2 = ioClient(baseUrl, { transports: ["websocket"] });

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

      c1.emit(SocketEvents.JOIN_ROOM, { roomId: "room_full_match", rows: 1, cols: 1, playerId: "p1" });
      c2.emit(SocketEvents.JOIN_ROOM, { roomId: "room_full_match", rows: 1, cols: 1, playerId: "p2" });

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

import type { Server } from "socket.io";
import { describe, expect, it, vi } from "vitest";
import { saveMatchIfFinished, type HandlerOptions } from "../../src/socket/handler";
import { SocketEvents } from "../../src/contracts/events";
import { RoomManager, type Room } from "../../src/room/roomManager";
import { MatchService } from "../../src/services/matchService";
import { BlockchainService } from "../../src/services/blockchainService";
import { createGame } from "game-core";

type SaveResultMock = HandlerOptions["matchService"]["saveResult"];

const blockchainEnv = {
  PORT: 3000,
  CORS_ORIGIN: "*",
  NODE_ENV: "test",
  JWT_SECRET: "test-secret-key-that-is-long-enough-for-tests",
  JWT_ISSUER: "squarexo-test-suite",
  JWT_AUDIENCE: "squarexo-test-clients",
  JWT_EXPIRES_IN: "7d",
  REFRESH_TOKEN_EXPIRES_IN: "30d",
  PUBLIC_BASE_URL: "http://localhost:3000",
  RECONNECT_TIMEOUT_MS: 30000,
  DEDUPE_WINDOW_MS: 15000,
  ROOM_SWEEP_INTERVAL_MS: 5000,
  OASIS_RPC_URL: "https://testnet.sapphire.oasis.io",
  BACKEND_SIGNER_PRIVATE_KEY: "0x1111111111111111111111111111111111111111111111111111111111111111",
  CONTRACT_ADDRESS: "0x1000000000000000000000000000000000000001",
} as const;

function createFinishedRoom(): { roomManager: RoomManager; room: Room } {
  const roomManager = new RoomManager(1000, 1000);
  const room = roomManager.getOrCreateRoom("room-test", 1, 1, createGame(1, 1));

  room.gameState.edges = [
    { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, takenBy: "X" },
    { from: { row: 1, col: 0 }, to: { row: 1, col: 1 }, takenBy: "O" },
    { from: { row: 0, col: 0 }, to: { row: 1, col: 0 }, takenBy: "X" },
    { from: { row: 0, col: 1 }, to: { row: 1, col: 1 }, takenBy: "O" },
  ];
  room.gameState.score = { X: 2, O: 1 };
  room.gameState.currentPlayer = "X";
  room.players.X = "player-x";
  room.players.O = "player-o";
  room.matchStartedAt = new Date("2026-04-10T00:00:00.000Z");

  return { roomManager, room };
}

describe("saveMatchIfFinished", () => {
  it("resets matchSaved on failure and retries successfully later", async () => {
    const { roomManager, room } = createFinishedRoom();
    const prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: "player-x", walletAddress: "0x1111111111111111111111111111111111111111" })
          .mockResolvedValueOnce({ id: "player-o", walletAddress: "0x2222222222222222222222222222222222222222" }),
      },
    };

    const saveResult = vi
      .fn<SaveResultMock>()
      .mockRejectedValueOnce(new Error("DB down"))
      .mockResolvedValueOnce({ id: "match-1" });
    const contractSubmitResult = vi.fn().mockResolvedValue({
      hash: "0xcontract-tx",
      wait: vi.fn().mockResolvedValue({ hash: "0xcontract-tx" }),
    });
    const options: HandlerOptions = {
      roomManager,
      publicBaseUrl: "http://localhost:3000",
      matchService: new MatchService(),
      blockchainService: new BlockchainService(blockchainEnv, {
        prisma,
        contractFactory: vi.fn().mockResolvedValue({ submitResult: contractSubmitResult }),
      }),
    };

    options.matchService.saveResult = saveResult;

    await expect(saveMatchIfFinished(options, room.roomId)).rejects.toThrow("DB down");
    expect(room.matchSaved).toBe(false);
    expect(saveResult).toHaveBeenCalledTimes(1);
    expect(saveResult.mock.calls[0][0].totalMoves).toBe(room.gameState.edges.length);

    await saveMatchIfFinished(options, room.roomId);
    expect(room.matchSaved).toBe(true);
    expect(saveResult).toHaveBeenCalledTimes(2);
  });

  it("uses the total number of edges as totalMoves", async () => {
    const { roomManager, room } = createFinishedRoom();
    const prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: "player-x", walletAddress: null })
          .mockResolvedValueOnce({ id: "player-o", walletAddress: null }),
      },
    };

    const saveResult = vi.fn<SaveResultMock>().mockResolvedValue({ id: "match-2" });
    const contractSubmitResult = vi.fn().mockResolvedValue({
      hash: "0xcontract-tx",
      wait: vi.fn().mockResolvedValue({ hash: "0xcontract-tx" }),
    });
    const options: HandlerOptions = {
      roomManager,
      publicBaseUrl: "http://localhost:3000",
      matchService: new MatchService(),
      blockchainService: new BlockchainService(blockchainEnv, {
        prisma,
        contractFactory: vi.fn().mockResolvedValue({ submitResult: contractSubmitResult }),
      }),
    };

    options.matchService.saveResult = saveResult;

    await saveMatchIfFinished(options, room.roomId);

    expect(saveResult).toHaveBeenCalledTimes(1);
    expect(saveResult.mock.calls[0][0].totalMoves).toBe(4);
  });

  it("emits match_settled when on-chain submit succeeds", async () => {
    const { roomManager, room } = createFinishedRoom();
    const prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: "player-x", walletAddress: "0x1111111111111111111111111111111111111111" })
          .mockResolvedValueOnce({ id: "player-o", walletAddress: "0x2222222222222222222222222222222222222222" }),
      },
    };

    const saveResult = vi.fn<SaveResultMock>().mockResolvedValue({ id: "match-3" });
    const contractSubmitResult = vi.fn().mockResolvedValue({
      hash: "0xtxhash",
      wait: vi.fn().mockResolvedValue({ hash: "0xtxhash" }),
    });
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));

    const options: HandlerOptions = {
      roomManager,
      publicBaseUrl: "http://localhost:3000",
      matchService: new MatchService(),
      blockchainService: new BlockchainService(blockchainEnv, {
        prisma,
        contractFactory: vi.fn().mockResolvedValue({ submitResult: contractSubmitResult }),
      }),
    };

    options.matchService.saveResult = saveResult;

    await saveMatchIfFinished(options, room.roomId, { to } as Server);

    expect(saveResult).toHaveBeenCalledTimes(1);
    expect(saveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        txHash: "0xtxhash",
      }),
    );
    expect(to).toHaveBeenCalledWith(room.roomId);
    expect(emit).toHaveBeenCalledWith(SocketEvents.MATCH_SETTLED, {
      roomId: room.roomId,
      txHash: "0xtxhash",
      winnerWallet: "0x1111111111111111111111111111111111111111",
    });
  });
});

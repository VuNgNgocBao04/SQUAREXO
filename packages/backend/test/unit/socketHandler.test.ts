import { describe, expect, it, vi } from "vitest";
import { saveMatchIfFinished, type HandlerOptions } from "../../src/socket/handler";
import { SocketEvents } from "../../src/contracts/events";
import type { Room } from "../../src/room/roomManager";

type SaveResultMock = HandlerOptions["matchService"]["saveResult"];
type SubmitResultMock = HandlerOptions["blockchainService"]["submitResult"];

function createFinishedRoom(): Room {
  return {
    roomId: "room-test",
    gameState: {
      edges: [
        { takenBy: "X" },
        { takenBy: "O" },
        { takenBy: "X" },
        { takenBy: "O" },
      ],
      score: { X: 2, O: 1 },
      currentPlayer: "X",
    } as never,
    stateVersion: 0,
    matchStartedAt: new Date("2026-04-10T00:00:00.000Z"),
    matchSaved: false,
    boardSize: { rows: 1, cols: 1 },
    players: { X: "player-x", O: "player-o" },
    socketToPlayerId: new Map<string, string>(),
    pendingReconnect: new Map<string, never>(),
    dedupe: new Map<string, never>(),
    moveInProgress: Promise.resolve(),
  };
}

describe("saveMatchIfFinished", () => {
  it("resets matchSaved on failure and retries successfully later", async () => {
    const room = createFinishedRoom();
    const saveResult = vi
      .fn<SaveResultMock>()
      .mockRejectedValueOnce(new Error("DB down"))
      .mockResolvedValueOnce({ id: "match-1" });
    const submitResult = vi.fn<SubmitResultMock>().mockResolvedValue({ submitted: false });

    const options: HandlerOptions = {
      roomManager: {
        getRoom: vi.fn(() => room),
      } as never,
      publicBaseUrl: "http://localhost:3000",
      matchService: {
        saveResult,
      } as never,
      blockchainService: {
        submitResult,
      } as never,
    };

    await expect(saveMatchIfFinished(options, room.roomId)).rejects.toThrow("DB down");
    expect(room.matchSaved).toBe(false);
    expect(saveResult).toHaveBeenCalledTimes(1);
    expect(saveResult.mock.calls[0][0].totalMoves).toBe(room.gameState.edges.length);

    await saveMatchIfFinished(options, room.roomId);
    expect(room.matchSaved).toBe(true);
    expect(saveResult).toHaveBeenCalledTimes(2);
  });

  it("uses the total number of edges as totalMoves", async () => {
    const room = createFinishedRoom();
    const saveResult = vi.fn<SaveResultMock>().mockResolvedValue({ id: "match-2" });
    const submitResult = vi.fn<SubmitResultMock>().mockResolvedValue({ submitted: false });

    const options: HandlerOptions = {
      roomManager: {
        getRoom: vi.fn(() => room),
      } as never,
      publicBaseUrl: "http://localhost:3000",
      matchService: {
        saveResult,
      } as never,
      blockchainService: {
        submitResult,
      } as never,
    };

    await saveMatchIfFinished(options, room.roomId);

    expect(saveResult).toHaveBeenCalledTimes(1);
    expect(saveResult.mock.calls[0][0].totalMoves).toBe(4);
  });

  it("emits match_settled when on-chain submit succeeds", async () => {
    const room = createFinishedRoom();
    const saveResult = vi.fn<SaveResultMock>().mockResolvedValue({ id: "match-3" });
    const submitResult = vi.fn<SubmitResultMock>().mockResolvedValue({
      submitted: true,
      txHash: "0xtxhash",
      winnerWallet: "0x1111111111111111111111111111111111111111",
    });
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));

    const options: HandlerOptions = {
      roomManager: {
        getRoom: vi.fn(() => room),
      } as never,
      publicBaseUrl: "http://localhost:3000",
      matchService: {
        saveResult,
      } as never,
      blockchainService: {
        submitResult,
      } as never,
    };

    await saveMatchIfFinished(options, room.roomId, { to } as never);

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

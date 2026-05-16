import { describe, expect, it } from "vitest";
import { RoomManager } from "../../src/room/roomManager";

const createTestGame = () => ({
  rows: 3,
  cols: 3,
  edges: [],
  boxes: [],
  currentPlayer: "X" as const,
  score: { X: 0, O: 0 },
});

describe("RoomManager", () => {
  it("assigns X then O then spectator", () => {
    const manager = new RoomManager(5000, 5000);
    const room = manager.getOrCreateRoom("room_1", 3, 3, createTestGame());

    expect(manager.assignSocket(room, "s1", "p1")).toBe("X");
    expect(manager.assignSocket(room, "s2", "p2")).toBe("O");
    expect(manager.assignSocket(room, "s3", "p3")).toBeNull();
  });

  it("keeps slot for reconnect timeout", () => {
    const manager = new RoomManager(100000, 5000);
    const room = manager.getOrCreateRoom("room_2", 3, 3, createTestGame());

    manager.assignSocket(room, "s1", "p1");
    manager.removeSocket("s1");

    const assigned = manager.assignSocket(room, "s1b", "p1");
    expect(assigned).toBe("X");
  });

  it("starts the match timer when the room becomes full", () => {
    const manager = new RoomManager(100000, 5000);
    const room = manager.getOrCreateRoom("room_2b", 3, 3, createTestGame());
    const initialStartedAt = room.matchStartedAt;

    expect(manager.assignSocket(room, "s1", "p1")).toBe("X");
    expect(room.matchStartedAt).toBe(initialStartedAt);

    expect(manager.assignSocket(room, "s2", "p2")).toBe("O");
    expect(room.matchStartedAt).not.toBe(initialStartedAt);
  });

  it("releases slot immediately when reserveForReconnect is false", () => {
    const manager = new RoomManager(100000, 5000);
    const room = manager.getOrCreateRoom("room_3", 3, 3, createTestGame());

    expect(manager.assignSocket(room, "s1", "p1")).toBe("X");
    manager.removeSocket("s1", { reserveForReconnect: false });

    expect(room.players.X).toBeNull();
    expect(room.pendingReconnect.size).toBe(0);
  });

  it("sweepExpired removes idle room after reconnect timeout", async () => {
    const manager = new RoomManager(5, 5000);
    const room = manager.getOrCreateRoom("room_4", 3, 3, createTestGame());

    manager.assignSocket(room, "s1", "p1");
    manager.removeSocket("s1");

    await new Promise((resolve) => setTimeout(resolve, 15));
    manager.sweepExpired();

    expect(manager.getRoom("room_4")).toBeUndefined();
  });
});

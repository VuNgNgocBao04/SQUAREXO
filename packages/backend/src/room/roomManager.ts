import type { GameState, Player } from "../types/gameCore";

type PlayerSlot = "X" | "O";

type PendingReconnect = {
  expiresAt: number;
  slot: PlayerSlot;
};

type ProcessedAction = {
  actionId: string;
  state: GameState;
  processedAt: number;
};

export type Room = {
  roomId: string;
  gameState: GameState;
  boardSize: { rows: number; cols: number };
  players: Record<PlayerSlot, string | null>;
  socketToPlayerId: Map<string, string>;
  pendingReconnect: Map<string, PendingReconnect>;
  dedupe: Map<string, ProcessedAction>;
};

export class RoomManager {
  private rooms = new Map<string, Room>();
  private socketToRoomId = new Map<string, string>();

  constructor(
    private readonly reconnectTimeoutMs: number,
    private readonly dedupeWindowMs: number,
  ) {}

  getRoomsCount(): number {
    return this.rooms.size;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getOrCreateRoom(roomId: string, rows: number, cols: number, initialState: GameState): Room {
    const existing = this.rooms.get(roomId);
    if (existing) {
      return existing;
    }

    const room: Room = {
      roomId,
      gameState: initialState,
      boardSize: { rows, cols },
      players: { X: null, O: null },
      socketToPlayerId: new Map<string, string>(),
      pendingReconnect: new Map<string, PendingReconnect>(),
      dedupe: new Map<string, ProcessedAction>(),
    };

    this.rooms.set(roomId, room);
    return room;
  }

  assignSocket(room: Room, socketId: string, requestedPlayerId: string): Player | null {
    room.socketToPlayerId.set(socketId, requestedPlayerId);
    this.socketToRoomId.set(socketId, room.roomId);

    const recover = room.pendingReconnect.get(requestedPlayerId);
    if (recover && recover.expiresAt > Date.now()) {
      room.players[recover.slot] = requestedPlayerId;
      room.pendingReconnect.delete(requestedPlayerId);
      return recover.slot;
    }

    if (room.players.X === requestedPlayerId) {
      return "X";
    }

    if (room.players.O === requestedPlayerId) {
      return "O";
    }

    if (!room.players.X) {
      room.players.X = requestedPlayerId;
      return "X";
    }

    if (!room.players.O) {
      room.players.O = requestedPlayerId;
      return "O";
    }

    return null;
  }

  getPlayerInRoom(room: Room, socketId: string): Player | null {
    const playerId = room.socketToPlayerId.get(socketId);
    if (!playerId) {
      return null;
    }

    if (room.players.X === playerId) {
      return "X";
    }

    if (room.players.O === playerId) {
      return "O";
    }

    return null;
  }

  removeSocket(
    socketId: string,
    options?: {
      reserveForReconnect?: boolean;
    },
  ): string | null {
    const reserveForReconnect = options?.reserveForReconnect ?? true;
    const indexedRoomId = this.socketToRoomId.get(socketId);

    if (indexedRoomId) {
      const room = this.rooms.get(indexedRoomId);
      if (room) {
        return this.removeSocketFromRoom(room, socketId, reserveForReconnect);
      }
      this.socketToRoomId.delete(socketId);
    }

    for (const room of this.rooms.values()) {
      if (room.socketToPlayerId.has(socketId)) {
        return this.removeSocketFromRoom(room, socketId, reserveForReconnect);
      }
    }

    return null;
  }

  private removeSocketFromRoom(room: Room, socketId: string, reserveForReconnect: boolean): string {
    const playerId = room.socketToPlayerId.get(socketId);
    if (!playerId) {
      return room.roomId;
    }

    room.socketToPlayerId.delete(socketId);
    this.socketToRoomId.delete(socketId);

    const hasOtherConnection = [...room.socketToPlayerId.values()].some((id) => id === playerId);
    if (!hasOtherConnection) {
      if (reserveForReconnect) {
        if (room.players.X === playerId) {
          room.pendingReconnect.set(playerId, {
            slot: "X",
            expiresAt: Date.now() + this.reconnectTimeoutMs,
          });
        }

        if (room.players.O === playerId) {
          room.pendingReconnect.set(playerId, {
            slot: "O",
            expiresAt: Date.now() + this.reconnectTimeoutMs,
          });
        }
      } else {
        if (room.players.X === playerId) {
          room.players.X = null;
        }
        if (room.players.O === playerId) {
          room.players.O = null;
        }
        room.pendingReconnect.delete(playerId);
      }
    }

    this.cleanupRoom(room.roomId);
    return room.roomId;
  }

  cleanupExpiredReconnect(room: Room): void {
    const now = Date.now();
    for (const [playerId, pending] of room.pendingReconnect.entries()) {
      if (pending.expiresAt <= now) {
        if (pending.slot === "X" && room.players.X === playerId) {
          room.players.X = null;
        }
        if (pending.slot === "O" && room.players.O === playerId) {
          room.players.O = null;
        }
        room.pendingReconnect.delete(playerId);
      }
    }
  }

  cleanupDedupe(room: Room): void {
    const now = Date.now();
    for (const [actionId, item] of room.dedupe.entries()) {
      if (now - item.processedAt > this.dedupeWindowMs) {
        room.dedupe.delete(actionId);
      }
    }
  }

  saveProcessedAction(room: Room, actionId: string, state: GameState): void {
    room.dedupe.set(actionId, {
      actionId,
      state,
      processedAt: Date.now(),
    });
  }

  getProcessedAction(room: Room, actionId: string): ProcessedAction | undefined {
    this.cleanupDedupe(room);
    return room.dedupe.get(actionId);
  }

  isRoomFull(room: Room): boolean {
    return !!(room.players.X && room.players.O);
  }

  cleanupRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    this.cleanupExpiredReconnect(room);

    const hasConnectedSocket = room.socketToPlayerId.size > 0;
    const hasReservedSlot = room.players.X || room.players.O;

    if (!hasConnectedSocket && !hasReservedSlot) {
      this.rooms.delete(roomId);
    }
  }

  sweepExpired(): void {
    for (const roomId of [...this.rooms.keys()]) {
      this.cleanupRoom(roomId);
    }
  }

  getPublicRoomInfo(room: Room, assignedPlayer: Player | null, baseUrl: string) {
    return {
      roomId: room.roomId,
      playerX: room.players.X,
      playerO: room.players.O,
      assignedPlayer,
      isFull: this.isRoomFull(room),
      boardSize: room.boardSize,
      roomUrl: `${baseUrl}/?room=${room.roomId}`,
    };
  }
}

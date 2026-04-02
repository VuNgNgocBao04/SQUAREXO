import type { Server, Socket } from "socket.io";
import type { Player } from "../types/gameCore";
import { logger } from "../config/logger";
import { SocketEvents } from "../contracts/events";
import { ContractError, ErrorCode, type ErrorPayload } from "../contracts/errors";
import {
  joinRoomSchema,
  makeMoveSchema,
  resetGameSchema,
  syncStateSchema,
} from "../contracts/schemas";
import { metrics } from "../observability/metrics";
import type { RoomManager } from "../room/roomManager";
import { applyMoveFromCore, createGameFromCore } from "../services/gameCoreAdapter";
import { parsePayload } from "../utils/validation";

type HandlerOptions = {
  roomManager: RoomManager;
  publicBaseUrl: string;
};

function toContractError(error: unknown): ContractError {
  if (error instanceof ContractError) {
    return error;
  }

  if (error instanceof Error && error.message === "Edge already taken") {
    return new ContractError(ErrorCode.EDGE_ALREADY_TAKEN, error.message);
  }

  if (error instanceof Error && error.message === "Invalid edge for this board") {
    return new ContractError(ErrorCode.INVALID_MOVE, error.message);
  }

  return new ContractError(ErrorCode.INTERNAL_ERROR, "Internal server error");
}

function emitError(socket: Socket, error: unknown): void {
  const normalized = toContractError(error);
  const payload: ErrorPayload = {
    code: normalized.code,
    message: normalized.message,
    metadata: normalized.metadata,
  };
  socket.emit(SocketEvents.ERROR, payload);
  metrics.incrementError();
}

function emitSnapshot(io: Server, roomId: string, state: Awaited<ReturnType<typeof createGameFromCore>>): void {
  io.to(roomId).emit(SocketEvents.GAME_STATE, {
    roomId,
    state,
    currentPlayer: state.currentPlayer,
  });
}

function assertPlayerTurn(player: Player | null, currentPlayer: Player): void {
  if (!player) {
    throw new ContractError(ErrorCode.NOT_IN_ROOM, "Socket is not assigned to a player in this room");
  }

  if (player !== currentPlayer) {
    throw new ContractError(ErrorCode.NOT_YOUR_TURN, "Not your turn", {
      currentPlayer,
      player,
    });
  }
}

export function registerSocketHandlers(io: Server, options: HandlerOptions): void {
  const socketToRoom = new Map<string, string>();

  io.on("connection", (socket) => {
    metrics.setActiveSockets(io.of("/").sockets.size);
    logger.info("socket_connected", { socketId: socket.id });

    socket.on(SocketEvents.JOIN_ROOM, async (rawPayload: unknown) => {
      try {
        const payload = parsePayload(joinRoomSchema, rawPayload);
        const rows = payload.rows ?? 3;
        const cols = payload.cols ?? 3;
        const playerId = payload.playerId ?? `anon:${socket.id}`;

        const existingRoomId = socketToRoom.get(socket.id);
        if (existingRoomId && existingRoomId !== payload.roomId) {
          socket.leave(existingRoomId);
          options.roomManager.removeSocket(socket.id);
        }

        const initialState = await createGameFromCore(rows, cols);
        const room = options.roomManager.getOrCreateRoom(payload.roomId, rows, cols, initialState);
        options.roomManager.cleanupExpiredReconnect(room);

        const assignedPlayer = options.roomManager.assignSocket(room, socket.id, playerId);
        socketToRoom.set(socket.id, room.roomId);
        socket.join(room.roomId);

        const roomInfo = options.roomManager.getPublicRoomInfo(room, assignedPlayer, options.publicBaseUrl);
        socket.emit(SocketEvents.ROOM_INFO, roomInfo);
        emitSnapshot(io, room.roomId, room.gameState);
        socket.to(room.roomId).emit(SocketEvents.PLAYER_JOINED, roomInfo);

        metrics.setActiveRooms(options.roomManager.getRoomsCount());
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(SocketEvents.MAKE_MOVE, async (rawPayload: unknown) => {
      const startedAt = Date.now();
      try {
        const payload = parsePayload(makeMoveSchema, rawPayload);
        const room = options.roomManager.getRoom(payload.roomId);
        if (!room) {
          throw new ContractError(ErrorCode.ROOM_NOT_FOUND, "Room not found", {
            roomId: payload.roomId,
          });
        }

        const deduped = options.roomManager.getProcessedAction(room, payload.actionId);
        if (deduped) {
          emitSnapshot(io, payload.roomId, deduped.state);
          return;
        }

        const assignedPlayer = options.roomManager.getPlayerInRoom(room, socket.id);
        assertPlayerTurn(assignedPlayer, room.gameState.currentPlayer);

        const nextState = await applyMoveFromCore(room.gameState, payload.edge);
        room.gameState = nextState;
        options.roomManager.saveProcessedAction(room, payload.actionId, nextState);

        emitSnapshot(io, payload.roomId, nextState);
        metrics.observeMoveLatency(Date.now() - startedAt);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(SocketEvents.RESET_GAME, async (rawPayload: unknown) => {
      try {
        const payload = parsePayload(resetGameSchema, rawPayload);
        const room = options.roomManager.getRoom(payload.roomId);

        if (!room) {
          throw new ContractError(ErrorCode.ROOM_NOT_FOUND, "Room not found", {
            roomId: payload.roomId,
          });
        }

        const assignedPlayer = options.roomManager.getPlayerInRoom(room, socket.id);
        if (!assignedPlayer) {
          throw new ContractError(ErrorCode.RESET_FORBIDDEN, "Only player in room can reset game");
        }

        room.gameState = await createGameFromCore(room.boardSize.rows, room.boardSize.cols);
        emitSnapshot(io, payload.roomId, room.gameState);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(SocketEvents.SYNC_STATE, (rawPayload: unknown) => {
      try {
        const payload = parsePayload(syncStateSchema, rawPayload);
        const room = options.roomManager.getRoom(payload.roomId);
        if (!room) {
          throw new ContractError(ErrorCode.ROOM_NOT_FOUND, "Room not found", {
            roomId: payload.roomId,
          });
        }
        socket.emit(SocketEvents.GAME_STATE, {
          roomId: payload.roomId,
          state: room.gameState,
          currentPlayer: room.gameState.currentPlayer,
        });
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on("disconnect", () => {
      const roomId = options.roomManager.removeSocket(socket.id);
      socketToRoom.delete(socket.id);
      if (!roomId) {
        return;
      }

      const room = options.roomManager.getRoom(roomId);
      if (!room) {
        io.to(roomId).emit(SocketEvents.ROOM_CLEANED, { roomId });
      } else {
        io.to(roomId).emit(
          SocketEvents.ROOM_INFO,
          options.roomManager.getPublicRoomInfo(room, null, options.publicBaseUrl),
        );
      }

      metrics.setActiveRooms(options.roomManager.getRoomsCount());
      metrics.setActiveSockets(io.of("/").sockets.size);
      logger.info("socket_disconnected", { socketId: socket.id, roomId });
    });
  });
}


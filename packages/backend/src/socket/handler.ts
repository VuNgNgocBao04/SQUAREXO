import type { Server, Socket } from "socket.io";
import type { Player } from "../types/gameCore";
import { logger } from "../config/logger";
import { getAuthenticatedUser } from "./authMiddleware";
import { SocketEvents } from "../contracts/events";
import { ContractError, ErrorCode, type ErrorPayload } from "../contracts/errors";
import {
  chatMessageSchema,
  joinRoomSchema,
  makeMoveSchema,
  rematchRequestSchema,
  rematchResponseSchema,
  resetGameSchema,
  syncStateSchema,
} from "../contracts/schemas";
import { metrics } from "../observability/metrics";
import type { RoomManager } from "../room/roomManager";
import { applyMoveFromCore, createGameFromCore } from "../services/gameCoreAdapter";
import type { BlockchainService } from "../services/blockchainService";
import { parsePayload } from "../utils/validation";
import type { JwtPayload } from "../types/auth";
import type { MatchService } from "../services/matchService";

export type HandlerOptions = {
  roomManager: RoomManager;
  publicBaseUrl: string;
  matchService: MatchService;
  blockchainService: BlockchainService;
};

type SocketContext = {
  lastMoveTime: number;
  moveCount: number;
  clientSequence: number;
};

const socketContextMap = new Map<string, SocketContext>();

function checkRateLimit(socketId: string): void {
  const now = Date.now();
  const ctx = socketContextMap.get(socketId);

  if (!ctx) {
    socketContextMap.set(socketId, {
      lastMoveTime: now,
      moveCount: 1,
      clientSequence: -1,
    });
    return;
  }

  if (now - ctx.lastMoveTime > 1000) {
    ctx.lastMoveTime = now;
    ctx.moveCount = 1;
    return;
  }

  ctx.moveCount += 1;
  if (ctx.moveCount > 2) {
    throw new ContractError(ErrorCode.VALIDATION_ERROR, "Too many moves, maximum 2 per second");
  }
}

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

function getSocketUser(socket: Socket): JwtPayload {
  try {
    return getAuthenticatedUser(socket);
  } catch (error) {
    throw new ContractError(
      ErrorCode.INTERNAL_ERROR,
      "Socket user context missing or invalid - socket must be authenticated before event handling",
    );
  }
}

export async function saveMatchIfFinished(
  options: HandlerOptions,
  roomId: string,
  io?: Server,
): Promise<void> {
  const room = options.roomManager.getRoom(roomId);
  if (!room || room.matchSaved) {
    return;
  }

  const allEdgesTaken = room.gameState.edges.every((edge) => !!edge.takenBy);
  if (!allEdgesTaken) {
    return;
  }

  const playerXId = room.players.X;
  const playerOId = room.players.O;
  if (!playerXId || !playerOId) {
    return;
  }

  const totalMoves = room.gameState.edges.length;

  // Set matchSaved optimistically BEFORE await to prevent race condition:
  // Multiple handlers (MOVE, SYNC_STATE) may check matchSaved concurrently.
  // If we only set after resolve, both could see false and attempt save.
  // Optimistic flag ensures only first caller proceeds; others see true and return.
  room.matchSaved = true;
  try {
    let txHash: string | undefined;
    let chainResult:
      | {
          submitted: boolean;
          txHash?: string;
          winnerWallet?: string;
          reason?: string;
        }
      | undefined;

    try {
      chainResult = await options.blockchainService.submitResult({
        roomId,
        playerXId,
        playerOId,
        scoreX: room.gameState.score.X,
        scoreO: room.gameState.score.O,
      });
    } catch (chainError) {
      logger.error("submit_result_onchain_failed", {
        roomId,
        error: chainError,
      });
    }

    const shouldRequireOnChainSettlement = options.blockchainService.isEnabled() && room.stakeRose > 0;
    if (shouldRequireOnChainSettlement && !chainResult?.submitted) {
      const reason = chainResult?.reason ?? "onchain_settlement_required";
      if (io) {
        io.to(roomId).emit(SocketEvents.MATCH_SETTLEMENT_FAILED, {
          roomId,
          reason,
        });
      }
      throw new ContractError(ErrorCode.INTERNAL_ERROR, "On-chain settlement failed", { reason });
    }

    if (chainResult?.submitted) {
      txHash = chainResult.txHash;
    }

    await options.matchService.saveResult({
      roomId,
      playerXId,
      playerOId,
      boardRows: room.boardSize.rows,
      boardCols: room.boardSize.cols,
      totalMoves,
      scoreX: room.gameState.score.X,
      scoreO: room.gameState.score.O,
      betAmount: room.stakeRose > 0 ? room.stakeRose * 2 : undefined,
      txHash,
      startedAt: room.matchStartedAt,
      endedAt: new Date(),
    });

    if (chainResult?.submitted && io) {
      io.to(roomId).emit(SocketEvents.MATCH_SETTLED, {
        roomId,
        txHash: chainResult.txHash,
        winnerWallet: chainResult.winnerWallet ?? null,
      });
    }
  } catch (error) {
    // Revert flag on error so retry is possible
    room.matchSaved = false;
    throw error;
  }
}

async function resetRoomForRematch(room: RoomManagerRoom): Promise<void> {
  room.gameState = await createGameFromCore(room.boardSize.rows, room.boardSize.cols);
  room.stateVersion += 1;
  room.matchSaved = false;
  room.matchStartedAt = new Date();
  room.rematchRequester = null;
  room.dedupe.clear();
}

function closeRoomAfterRematchDecline(io: Server, options: HandlerOptions, roomId: string): void {
  const room = options.roomManager.getRoom(roomId);
  if (!room) {
    io.to(roomId).emit(SocketEvents.ROOM_CLEANED, { roomId });
    return;
  }

  for (const socketId of [...room.socketToPlayerId.keys()]) {
    const sock = io.of("/").sockets.get(socketId);
    sock?.leave(roomId);
    options.roomManager.removeSocket(socketId, { reserveForReconnect: false });
  }

  io.to(roomId).emit(SocketEvents.ROOM_CLEANED, { roomId });
  metrics.setActiveRooms(options.roomManager.getRoomsCount());
  metrics.setActiveSockets(io.of("/").sockets.size);
}

type RoomManagerRoom = ReturnType<RoomManager["getOrCreateRoom"]>;

export function registerSocketHandlers(io: Server, options: HandlerOptions): void {
  const socketToRoom = new Map<string, string>();

  io.on("connection", (socket) => {
    socketContextMap.set(socket.id, {
      lastMoveTime: 0,
      moveCount: 0,
      clientSequence: -1,
    });

    metrics.setActiveSockets(io.of("/").sockets.size);
    logger.info("socket_connected", { socketId: socket.id });

    socket.on(SocketEvents.JOIN_ROOM, async (rawPayload: unknown) => {
      try {
        const payload = parsePayload(joinRoomSchema, rawPayload);
        const rows = payload.rows ?? 3;
        const cols = payload.cols ?? 3;
        const requestedStakeRose = payload.stakeRose ?? 0;
        const playerId = getSocketUser(socket).userId;

        const existingRoomId = socketToRoom.get(socket.id);
        if (existingRoomId && existingRoomId !== payload.roomId) {
          socket.leave(existingRoomId);
          options.roomManager.removeSocket(socket.id, { reserveForReconnect: false });
        }

        const existingRoom = options.roomManager.getRoom(payload.roomId);
        const room = existingRoom
          ? existingRoom
          : options.roomManager.getOrCreateRoom(
            payload.roomId,
            rows,
            cols,
            await createGameFromCore(rows, cols),
            requestedStakeRose,
          );
        options.roomManager.cleanupExpiredReconnect(room);

        if (
          (payload.rows !== undefined && payload.rows !== room.boardSize.rows) ||
          (payload.cols !== undefined && payload.cols !== room.boardSize.cols)
        ) {
          throw new ContractError(ErrorCode.VALIDATION_ERROR, "Requested board size does not match existing room", {
            expected: room.boardSize,
            requested: {
              rows: payload.rows,
              cols: payload.cols,
            },
          });
        }

        if (payload.stakeRose !== undefined && Math.abs(payload.stakeRose - room.stakeRose) > 1e-9) {
          throw new ContractError(
            ErrorCode.VALIDATION_ERROR,
            "Requested stake does not match room stake",
            {
              expectedStakeRose: room.stakeRose,
              requestedStakeRose: payload.stakeRose,
            },
          );
        }

        const hasActiveSameIdentity = [...room.socketToPlayerId.entries()].some(
          ([trackedSocketId, trackedPlayerId]) => trackedSocketId !== socket.id && trackedPlayerId === playerId,
        );
        if (hasActiveSameIdentity) {
          throw new ContractError(
            ErrorCode.VALIDATION_ERROR,
            "Player identity is already active in this room",
            { roomId: room.roomId, playerId },
          );
        }

        const assignedPlayer = options.roomManager.assignSocket(room, socket.id, playerId);
        socketToRoom.set(socket.id, room.roomId);
        socket.join(room.roomId);

        const roomInfo = options.roomManager.getPublicRoomInfo(room, assignedPlayer, options.publicBaseUrl);
        if (room.players.X && room.players.O) {
          room.rematchRequester = null;
        }
        socket.emit(SocketEvents.ROOM_INFO, roomInfo);
        emitSnapshot(io, room.roomId, room.gameState);
        socket.to(room.roomId).emit(SocketEvents.PLAYER_JOINED, roomInfo);

        // Attempt to save match if finished. Most common case: new player joining
        // won't have game finished (returns early). Important case: player rejoining
        // after game completed but match wasn't saved (e.g., prior save failed).
        // This ensures eventual save without requiring additional retry logic.
        try {
          await saveMatchIfFinished(options, room.roomId, io);
        } catch (error) {
          logger.error("save_match_failed", {
            roomId: room.roomId,
            error,
          });
        }

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

        checkRateLimit(socket.id);

        const ctx = socketContextMap.get(socket.id);
        if (ctx && payload.clientSequence !== undefined) {
          if (payload.clientSequence <= ctx.clientSequence) {
            throw new ContractError(
              ErrorCode.VALIDATION_ERROR,
              "Duplicate or out-of-order client sequence",
            );
          }
          ctx.clientSequence = payload.clientSequence;
        }

        const runMove = async (): Promise<void> => {
          if (!room.socketToPlayerId.has(socket.id)) {
            throw new ContractError(ErrorCode.NOT_IN_ROOM, "Socket disconnected during move processing");
          }

          const deduped = options.roomManager.getProcessedAction(room, payload.actionId);
          if (deduped) {
            if (deduped.stateVersion === room.stateVersion) {
              emitSnapshot(io, payload.roomId, deduped.state);
            } else {
              emitSnapshot(io, payload.roomId, room.gameState);
            }
            return;
          }

          const assignedPlayer = options.roomManager.getPlayerInRoom(room, socket.id);
          assertPlayerTurn(assignedPlayer, room.gameState.currentPlayer);

          const nextState = await applyMoveFromCore(room.gameState, payload.edge);
          room.gameState = nextState;
          room.stateVersion += 1;
          options.roomManager.saveProcessedAction(room, payload.actionId, nextState, room.stateVersion);

          emitSnapshot(io, payload.roomId, nextState);
          try {
            await saveMatchIfFinished(options, payload.roomId, io);
          } catch (error) {
            logger.error("save_match_failed", {
              roomId: payload.roomId,
              error,
            });
          }
          metrics.observeMoveLatency(Date.now() - startedAt);
        };

        room.moveInProgress = room.moveInProgress.catch(() => undefined).then(runMove);
        await room.moveInProgress;
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

        const runReset = async (): Promise<void> => {
          if (!room.socketToPlayerId.has(socket.id)) {
            throw new ContractError(ErrorCode.NOT_IN_ROOM, "Socket disconnected during reset");
          }

          const assignedPlayer = options.roomManager.getPlayerInRoom(room, socket.id);
          if (!assignedPlayer) {
            throw new ContractError(ErrorCode.RESET_FORBIDDEN, "Only player in room can reset game");
          }

          room.gameState = await createGameFromCore(room.boardSize.rows, room.boardSize.cols);
          room.stateVersion += 1;
          room.matchSaved = false;
          room.matchStartedAt = new Date();
          room.rematchRequester = null;
          emitSnapshot(io, payload.roomId, room.gameState);
        };

        room.moveInProgress = room.moveInProgress.catch(() => undefined).then(runReset);
        await room.moveInProgress;
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(SocketEvents.SYNC_STATE, async (rawPayload: unknown) => {
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

        try {
          await saveMatchIfFinished(options, payload.roomId, io);
        } catch (error) {
          logger.error("save_match_failed", {
            roomId: payload.roomId,
            error,
          });
        }
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(SocketEvents.CHAT_MESSAGE, (rawPayload: unknown) => {
      try {
        const payload = parsePayload(chatMessageSchema, rawPayload);
        const room = options.roomManager.getRoom(payload.roomId);

        if (!room) {
          throw new ContractError(ErrorCode.ROOM_NOT_FOUND, "Room not found", {
            roomId: payload.roomId,
          });
        }

        const playerId = room.socketToPlayerId.get(socket.id);
        if (!playerId) {
          throw new ContractError(ErrorCode.NOT_IN_ROOM, "Socket is not in this room");
        }

        const assignedPlayer = options.roomManager.getPlayerInRoom(room, socket.id);
        if (!assignedPlayer) {
          throw new ContractError(ErrorCode.NOT_IN_ROOM, "Socket is not assigned to a player in this room");
        }

        io.to(payload.roomId).emit(SocketEvents.CHAT_MESSAGE, {
          roomId: payload.roomId,
          playerId,
          player: assignedPlayer,
          message: payload.message,
          sentAt: Date.now(),
        });
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(SocketEvents.REMATCH_REQUEST, async (rawPayload: unknown) => {
      try {
        const payload = parsePayload(rematchRequestSchema, rawPayload);
        const room = options.roomManager.getRoom(payload.roomId);
        if (!room) {
          throw new ContractError(ErrorCode.ROOM_NOT_FOUND, "Room not found", {
            roomId: payload.roomId,
          });
        }

        const requester = options.roomManager.getPlayerInRoom(room, socket.id);
        if (!requester) {
          throw new ContractError(ErrorCode.NOT_IN_ROOM, "Only players can request rematch");
        }

        if (!room.players.X || !room.players.O) {
          throw new ContractError(ErrorCode.VALIDATION_ERROR, "Room must have two players for rematch");
        }

        room.rematchRequester = requester;
        const requesterId = room.socketToPlayerId.get(socket.id) ?? requester;
        const opponent: Player = requester === "X" ? "O" : "X";
        const opponentSocketId = [...room.socketToPlayerId.entries()].find(
          ([trackedSocketId]) => options.roomManager.getPlayerInRoom(room, trackedSocketId) === opponent,
        )?.[0];

        io.to(payload.roomId).emit(SocketEvents.REMATCH_PROMPT, {
          roomId: payload.roomId,
          from: requester,
          requesterId,
        });

        if (opponentSocketId) {
          io.to(opponentSocketId).emit(SocketEvents.REMATCH_PROMPT, {
            roomId: payload.roomId,
            from: requester,
            requesterId,
            target: "opponent",
          });
        }
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(SocketEvents.REMATCH_RESPONSE, async (rawPayload: unknown) => {
      try {
        const payload = parsePayload(rematchResponseSchema, rawPayload);
        const room = options.roomManager.getRoom(payload.roomId);
        if (!room) {
          throw new ContractError(ErrorCode.ROOM_NOT_FOUND, "Room not found", {
            roomId: payload.roomId,
          });
        }

        const responder = options.roomManager.getPlayerInRoom(room, socket.id);
        if (!responder) {
          throw new ContractError(ErrorCode.NOT_IN_ROOM, "Only players can respond rematch");
        }

        const requester = room.rematchRequester;
        if (!requester) {
          throw new ContractError(ErrorCode.VALIDATION_ERROR, "No rematch request is pending");
        }

        if (requester === responder) {
          throw new ContractError(ErrorCode.VALIDATION_ERROR, "Requester cannot self-approve rematch");
        }

        if (!payload.accept) {
          room.rematchRequester = null;
          io.to(payload.roomId).emit(SocketEvents.REMATCH_DECLINED, {
            roomId: payload.roomId,
            by: responder,
          });
          closeRoomAfterRematchDecline(io, options, payload.roomId);
          return;
        }

        await resetRoomForRematch(room);
        io.to(payload.roomId).emit(SocketEvents.REMATCH_STARTED, {
          roomId: payload.roomId,
        });
        emitSnapshot(io, payload.roomId, room.gameState);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on("disconnect", () => {
      const roomId = options.roomManager.removeSocket(socket.id);
      socketToRoom.delete(socket.id);
      socketContextMap.delete(socket.id);
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


/**
 * Socket.IO Event Handlers with Game-Core Integration
 * 
 * Manages:
 * - Room state (players, game)
 * - Game moves (validate + apply game-core logic)
 * - Player tracking + assignments
 * - Real-time sync
 */

import { Server, Socket } from 'socket.io';
import { roomStore } from '../store/roomStore';
import { createGameFromCore, applyMoveFromCore } from '../services/gameCoreAdapter';
import {
  SocketEvents,
  JoinRoomPayload,
  MakeMovePayload,
  ResetGamePayload,
  GameStatePayload,
  ErrorPayload,
  PlayerJoinedPayload,
  RoomInfoPayload,
} from './events';

// Track socket → room mapping for cleanup
const socketRooms = new Map<string, string>();
const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    /**
     * Event: join_room
     * Client vào phòng → assign X/O → sync state
     */
    socket.on(SocketEvents.JOIN_ROOM, async (payload: JoinRoomPayload) => {
      const { roomId, rows = 3, cols = 3 } = payload;

      if (!roomId || typeof roomId !== 'string') {
        socket.emit(SocketEvents.ERROR, {
          message: 'Invalid roomId',
          code: 'INVALID_ROOM',
        } as ErrorPayload);
        return;
      }

      try {
        let room = roomStore.getRoom(roomId);
        if (!room) {
          const initialState = await createGameFromCore(rows, cols);
          room = roomStore.createRoom(roomId, initialState, rows, cols);
        }

        // Assign player (X or O)
        const { player, isFull } = roomStore.assignPlayer(roomId, socket.id);
        socketRooms.set(socket.id, roomId);

        // Socket join broadcasting room
        socket.join(roomId);
        console.log(
          `[Socket] ${player ? `Player ${player}` : 'Spectator'} (${socket.id}) joined room ${roomId}`
        );

        // Send room info to joining player
        const roomInfo: RoomInfoPayload = {
          roomId,
          playerX: room.playerX,
          playerO: room.playerO,
          assignedPlayer: player,
          isFull,
          boardSize: room.boardSize,
          roomUrl: roomStore.getRoomUrl(roomId, publicBaseUrl),
        };

        socket.emit(SocketEvents.ROOM_INFO, roomInfo);

        // Send current game state
        const gameState: GameStatePayload = {
          roomId,
          state: room.gameState,
          currentPlayer: room.gameState.currentPlayer,
        };
        socket.emit(SocketEvents.GAME_STATE, gameState);

        // Notify others in room
        socket.to(roomId).emit(SocketEvents.PLAYER_JOINED, {
          player,
          playerX: room.playerX,
          playerO: room.playerO,
          isFull,
          roomUrl: roomStore.getRoomUrl(roomId, publicBaseUrl),
        } as PlayerJoinedPayload);

        // Notify all if room full
        if (isFull) {
          io.to(roomId).emit(SocketEvents.ROOM_FULL, {
            message: 'Room is now full. Game can start!',
          });
        }
      } catch (error) {
        console.error('[Socket] Error in join_room:', error);
        socket.emit(SocketEvents.ERROR, {
          message: error instanceof Error ? error.message : 'Failed to join room',
          code: 'JOIN_FAILED',
        } as ErrorPayload);
      }
    });

    /**
     * Event: make_move
     * Apply move từ game-core → update state → broadcast
     */
    socket.on(SocketEvents.MAKE_MOVE, async (payload: MakeMovePayload) => {
      const { roomId, edge } = payload;

      if (!roomId || !edge) {
        socket.emit(SocketEvents.ERROR, {
          message: 'Invalid roomId or edge',
          code: 'INVALID_MOVE_DATA',
        } as ErrorPayload);
        return;
      }

      try {
        const room = roomStore.getRoom(roomId);
        if (!room) {
          socket.emit(SocketEvents.ERROR, {
            message: 'Room not found',
            code: 'ROOM_NOT_FOUND',
          } as ErrorPayload);
          return;
        }

        // Validate: only current player can move
        const playerAssignment = roomStore.getPlayerAssignment(roomId, socket.id);
        if (!playerAssignment) {
          socket.emit(SocketEvents.ERROR, {
            message: 'You are not in this room',
            code: 'NOT_IN_ROOM',
          } as ErrorPayload);
          return;
        }

        if (room.gameState.currentPlayer !== playerAssignment) {
          socket.emit(SocketEvents.ERROR, {
            message: `It's not your turn. Current player: ${room.gameState.currentPlayer}`,
            code: 'NOT_YOUR_TURN',
          } as ErrorPayload);
          return;
        }

        const updatedState = await applyMoveFromCore(room.gameState, edge);

        // Update room state
        roomStore.updateGameState(roomId, updatedState);

        // Broadcast updated state to all in room
        const gameState: GameStatePayload = {
          roomId,
          state: updatedState,
          currentPlayer: updatedState.currentPlayer,
        };
        io.to(roomId).emit(SocketEvents.GAME_STATE, gameState);

        console.log(
          `[Socket] Move applied in room ${roomId}: ${playerAssignment} placed edge. Next: ${updatedState.currentPlayer}`
        );
      } catch (error) {
        console.error('[Socket] Error in make_move:', error);
        socket.emit(SocketEvents.ERROR, {
          message: error instanceof Error ? error.message : 'Failed to apply move',
          code: error instanceof Error && error.message.includes('Edge') ? 'INVALID_EDGE' : 'MOVE_FAILED',
        } as ErrorPayload);
      }
    });

    /**
     * Event: reset_game
     * Re-initialize game state using game-core createGame
     */
    socket.on(SocketEvents.RESET_GAME, async (payload: ResetGamePayload) => {
      const { roomId } = payload;

      if (!roomId) {
        socket.emit(SocketEvents.ERROR, {
          message: 'Invalid roomId',
          code: 'INVALID_ROOM',
        } as ErrorPayload);
        return;
      }

      try {
        const room = roomStore.getRoom(roomId);
        if (!room) {
          socket.emit(SocketEvents.ERROR, {
            message: 'Room not found',
            code: 'ROOM_NOT_FOUND',
          } as ErrorPayload);
          return;
        }

        const freshState = await createGameFromCore(room.boardSize.rows, room.boardSize.cols);
        roomStore.resetGame(roomId, freshState);

        // Broadcast reset state to all in room
        io.to(roomId).emit(SocketEvents.GAME_STATE, {
          roomId,
          state: freshState,
          currentPlayer: freshState.currentPlayer,
        } as GameStatePayload);

        console.log(`[Socket] Game reset in room ${roomId}`);
      } catch (error) {
        console.error('[Socket] Error in reset_game:', error);
        socket.emit(SocketEvents.ERROR, {
          message: error instanceof Error ? error.message : 'Failed to reset game',
          code: 'RESET_FAILED',
        } as ErrorPayload);
      }
    });

    /**
     * Event: disconnect
     * Clean up player from room + notify others
     */
    socket.on('disconnect', () => {
      const roomId = socketRooms.get(socket.id);
      
      if (roomId) {
        // Remove player from room
        roomStore.removePlayer(roomId, socket.id);
        
        const room = roomStore.getRoom(roomId);
        console.log(
          `[Socket] Player disconnected from ${roomId}. Remaining: ${room ? 'X=' + room.playerX + ', O=' + room.playerO : 'room deleted'}`
        );

        // Notify remaining players
        if (room) {
          io.to(roomId).emit(SocketEvents.ROOM_INFO, {
            roomId,
            playerX: room.playerX,
            playerO: room.playerO,
            assignedPlayer: null,
            isFull: roomStore.isRoomFull(roomId),
            boardSize: room.boardSize,
            roomUrl: roomStore.getRoomUrl(roomId, publicBaseUrl),
          } as RoomInfoPayload);
        }
      }

      socketRooms.delete(socket.id);
    });

    /**
     * Error handler
     */
    socket.on('error', (error) => {
      console.error('[Socket] Socket error:', error);
    });
  });
}


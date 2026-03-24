/**
 * Socket.IO Event Handlers
 * 
 * Manages room events and broadcasts game state changes
 */

import { Server, Socket } from 'socket.io';
import { roomStore } from '../store/roomStore';
import {
  SocketEvents,
  JoinRoomPayload,
  MakeMovePayload,
  ResetGamePayload,
  ErrorPayload,
} from './events';

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    /**
     * Event: join_room
     * Client enters or creates a room
     * - Joins Socket.IO room namespace
     * - Returns current game state
     */
    socket.on(SocketEvents.JOIN_ROOM, (payload: JoinRoomPayload) => {
      const { roomId } = payload;

      if (!roomId || typeof roomId !== 'string') {
        socket.emit(SocketEvents.ERROR, {
          message: 'Invalid roomId',
        } as ErrorPayload);
        return;
      }

      try {
        // Get or create room state
        const gameState = roomStore.getRoom(roomId);

        // Join Socket.IO room
        socket.join(roomId);
        console.log(`[Socket] Client ${socket.id} joined room ${roomId}`);

        // Send current state to joining client
        socket.emit(SocketEvents.GAME_STATE, {
          roomId,
          state: gameState,
        });

        // Notify other clients in room about the join
        socket.to(roomId).emit(SocketEvents.GAME_STATE, {
          roomId,
          state: gameState,
        });
      } catch (error) {
        console.error('[Socket] Error in join_room:', error);
        socket.emit(SocketEvents.ERROR, {
          message: 'Failed to join room',
        } as ErrorPayload);
      }
    });

    /**
     * Event: make_move
     * Client makes a game move (e.g., place an edge)
     * - Update room state
     * - Broadcast new state to all clients in room
     */
    socket.on(SocketEvents.MAKE_MOVE, (payload: MakeMovePayload) => {
      const { roomId, edge } = payload;

      if (!roomId || edge === undefined) {
        socket.emit(SocketEvents.ERROR, {
          message: 'Invalid roomId or edge',
        } as ErrorPayload);
        return;
      }

      try {
        const gameState = roomStore.getRoom(roomId);

        // TODO: Apply move logic from game-core
        // Example (to be replaced with actual game logic):
        // gameState.moves = gameState.moves || [];
        // gameState.moves.push({ playerId: socket.id, edge });

        roomStore.updateRoom(roomId, gameState);

        // Broadcast updated state to all clients in room
        io.to(roomId).emit(SocketEvents.GAME_STATE, {
          roomId,
          state: gameState,
        });

        console.log(`[Socket] Move made in room ${roomId} by ${socket.id}`);
      } catch (error) {
        console.error('[Socket] Error in make_move:', error);
        socket.emit(SocketEvents.ERROR, {
          message: 'Failed to make move',
        } as ErrorPayload);
      }
    });

    /**
     * Event: reset_game
     * Reset the game state in a room
     */
    socket.on(SocketEvents.RESET_GAME, (payload: ResetGamePayload) => {
      const { roomId } = payload;

      if (!roomId) {
        socket.emit(SocketEvents.ERROR, {
          message: 'Invalid roomId',
        } as ErrorPayload);
        return;
      }

      try {
        // TODO: Initialize fresh game state from game-core
        const freshState = {
          roomId,
          createdAt: new Date(),
          players: [],
          // ... other game state initialization
        };

        roomStore.updateRoom(roomId, freshState);

        // Broadcast reset state to all clients in room
        io.to(roomId).emit(SocketEvents.GAME_STATE, {
          roomId,
          state: freshState,
        });

        console.log(`[Socket] Game reset in room ${roomId}`);
      } catch (error) {
        console.error('[Socket] Error in reset_game:', error);
        socket.emit(SocketEvents.ERROR, {
          message: 'Failed to reset game',
        } as ErrorPayload);
      }
    });

    /**
     * Event: disconnect
     * Handle client disconnection
     */
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      // TODO: Clean up player from all rooms and notify others
    });

    /**
     * Error handler
     */
    socket.on('error', (error) => {
      console.error('[Socket] Socket error:', error);
    });
  });
}

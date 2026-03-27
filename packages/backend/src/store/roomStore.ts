/**
 * Room Store with Local Game State Management
 * 
 * Manages:
 * - Game state (matching game-core GameState interface)
 * - Player mapping (X/O assignments)
 * - Room metadata (URL, creation time)
 * 
 * 💡 MVP solution using Map. 
 * For production: Replace with Redis
 */

import { GameState, Player } from '../socket/events';

export interface Room {
  roomId: string;
  gameState: GameState; // From game-core createGame()
  playerX: string | null; // socket.id của player X
  playerO: string | null; // socket.id của player O
  createdAt: Date;
  boardSize: {
    rows: number;
    cols: number;
  };
}

class RoomStore {
  private rooms: Map<string, Room> = new Map();

  /**
   * Create new room with game state initialized
   */
  createRoom(roomId: string, gameState: GameState, rows = 3, cols = 3): Room {
    if (this.rooms.has(roomId)) {
      throw new Error(`Room ${roomId} already exists`);
    }
    
    const room: Room = {
      roomId,
      gameState,
      playerX: null,
      playerO: null,
      createdAt: new Date(),
      boardSize: { rows, cols },
    };

    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Assign player to room (X or first available)
   */
  assignPlayer(roomId: string, socketId: string): { player: Player | null; isFull: boolean } {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    if (room.playerX === socketId) {
      return { player: 'X', isFull: !!room.playerO };
    }

    if (room.playerO === socketId) {
      return { player: 'O', isFull: true };
    }

    // Assign to first empty slot
    if (!room.playerX) {
      room.playerX = socketId;
      return { player: 'X', isFull: false };
    } else if (!room.playerO) {
      room.playerO = socketId;
      return { player: 'O', isFull: true };
    } else {
      return { player: null, isFull: true };
    }
  }

  /**
   * Get player assignment for a socket
   */
  getPlayerAssignment(roomId: string, socketId: string): Player | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    if (room.playerX === socketId) return 'X';
    if (room.playerO === socketId) return 'O';
    return null;
  }

  /**
   * Update game state
   */
  updateGameState(roomId: string, gameState: GameState): void {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);
    room.gameState = gameState;
  }

  /**
   * Reset game state in room
   */
  resetGame(roomId: string, gameState: GameState): GameState {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);
    
    room.gameState = gameState;
    return room.gameState;
  }

  /**
   * Remove player from room
   */
  removePlayer(roomId: string, socketId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.playerX === socketId) {
      room.playerX = null;
    } else if (room.playerO === socketId) {
      room.playerO = null;
    }

    // Delete room if empty
    if (!room.playerX && !room.playerO) {
      this.rooms.delete(roomId);
    }
  }

  /**
   * Get room info
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get room URL (for sharing)
   */
  getRoomUrl(roomId: string, baseUrl = 'http://localhost:3000'): string {
    return `${baseUrl}/?room=${roomId}`;
  }

  /**
   * Check if room has both players
   */
  isRoomFull(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    return room ? !!(room.playerX && room.playerO) : false;
  }

  /**
   * Get room stats for admin
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Delete room
   */
  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }
}

export const roomStore = new RoomStore();

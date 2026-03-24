/**
 * In-memory Room Store
 * 
 * 💡 MVP solution using Map. 
 * For production/scaling with multiple server instances:
 *    Replace with Redis pub/sub approach
 */

interface GameState {
  [key: string]: any; // Game state structure from game-core
}

class RoomStore {
  private rooms: Map<string, GameState>;

  constructor() {
    this.rooms = new Map();
  }

  /**
   * Get room state by ID, create empty state if not exists
   */
  getRoom(roomId: string): GameState {
    if (!this.rooms.has(roomId)) {
      // Initialize empty room with default state
      this.rooms.set(roomId, {
        roomId,
        createdAt: new Date(),
        players: [],
      });
    }
    return this.rooms.get(roomId)!;
  }

  /**
   * Update room state
   */
  updateRoom(roomId: string, state: GameState): void {
    this.rooms.set(roomId, state);
  }

  /**
   * Delete room (cleanup)
   */
  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  /**
   * Check if room exists
   */
  roomExists(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  /**
   * Get all rooms (useful for debugging/admin)
   */
  getAllRooms(): Map<string, GameState> {
    return new Map(this.rooms);
  }
}

export const roomStore = new RoomStore();

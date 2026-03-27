/**
 * Socket.IO Event definitions and types
 * 
 * Note: GameState, Player, and Edge types are locally duplicated here to avoid circular imports.
 * Original definitions live in game-core/src/types/GameState.ts.
 */

// Local copies of game-core types (for compatibility; keep in sync manually)
export type Player = "X" | "O";

export interface Point {
    row: number;
    col: number;
}

export interface Edge {
    from: Point;
    to: Point;
    takenBy?: Player;
}

export interface GameState {
    rows: number;
    cols: number;
    edges: Edge[];
    currentPlayer: Player;
    score: Record<Player, number>;
}

export enum SocketEvents {
  JOIN_ROOM = 'join_room',
  MAKE_MOVE = 'make_move',
  RESET_GAME = 'reset_game',
  GAME_STATE = 'game_state',
  ERROR = 'error',
  PLAYER_JOINED = 'player_joined',
  ROOM_FULL = 'room_full',
  ROOM_INFO = 'room_info',
}

// Incoming Payloads (Client → Server) 

export interface JoinRoomPayload {
  roomId: string;
  rows?: number;
  cols?: number;
}

export interface MakeMovePayload {
  roomId: string;
  edge: Edge; // From game-core
}

export interface ResetGamePayload {
  roomId: string;
}

//Outgoing Payloads (Server → Client) 

export interface GameStatePayload {
  roomId: string;
  state: GameState;
  currentPlayer: Player;
}

export interface PlayerJoinedPayload {
  player: Player | null;
  playerX: string | null;
  playerO: string | null;
  isFull: boolean;
  roomUrl: string;
}

export interface RoomInfoPayload {
  roomId: string;
  playerX: string | null;
  playerO: string | null;
  assignedPlayer: Player | null;
  isFull: boolean;
  boardSize: { rows: number; cols: number };
  roomUrl: string;
}

export interface ErrorPayload {
  message: string;
  code?: string;
}

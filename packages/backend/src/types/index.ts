// Game events
export enum SocketEvents {
  JOIN_ROOM = 'join_room',
  MAKE_MOVE = 'make_move',
  RESET_GAME = 'reset_game',
  GAME_STATE = 'game_state',
  ERROR = 'error',
}

// Payload types
export interface JoinRoomPayload {
  roomId: string;
}

export interface MakeMovePayload {
  roomId: string;
  edge: string; // hoặc number tùy game-core definition
}

export interface ResetGamePayload {
  roomId: string;
}

export interface GameStatePayload {
  roomId: string;
  state: any; // GameState từ game-core
}

export interface ErrorPayload {
  message: string;
}

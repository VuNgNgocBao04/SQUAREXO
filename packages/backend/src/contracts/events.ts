export const SocketEvents = {
  JOIN_ROOM: "join_room",
  MAKE_MOVE: "make_move",
  RESET_GAME: "reset_game",
  SYNC_STATE: "sync_state",
  CHAT_MESSAGE: "chat_message",

  ROOM_INFO: "room_info",
  GAME_STATE: "game_state",
  PLAYER_JOINED: "player_joined",
  PLAYER_LEFT: "player_left",
  ROOM_CLEANED: "room_cleaned",
  CHAT_MESSAGE_BROADCAST: "chat_message",
  MATCH_SETTLED: "match_settled",
  ERROR: "error",
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

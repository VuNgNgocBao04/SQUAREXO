export const SocketEvents = {
  JOIN_ROOM: "join_room",
  MAKE_MOVE: "make_move",
  RESET_GAME: "reset_game",
  SYNC_STATE: "sync_state",
  CHAT_MESSAGE: "chat_message",
  REMATCH_REQUEST: "rematch_request",
  REMATCH_RESPONSE: "rematch_response",

  ROOM_INFO: "room_info",
  GAME_STATE: "game_state",
  PLAYER_JOINED: "player_joined",
  GAME_OVER: "game_over",
  PLAYER_LEFT: "player_left",
  ROOM_CLEANED: "room_cleaned",
  CHAT_MESSAGE_BROADCAST: "chat_message",
  MATCH_SETTLED: "match_settled",
  MATCH_SETTLEMENT_FAILED: "match_settlement_failed",
  REMATCH_PROMPT: "rematch_prompt",
  REMATCH_STARTED: "rematch_started",
  REMATCH_DECLINED: "rematch_declined",
  ERROR: "error",
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

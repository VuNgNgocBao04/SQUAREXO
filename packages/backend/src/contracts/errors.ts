export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  ROOM_NOT_FOUND = "ROOM_NOT_FOUND",
  ROOM_FULL = "ROOM_FULL",
  NOT_IN_ROOM = "NOT_IN_ROOM",
  NOT_YOUR_TURN = "NOT_YOUR_TURN",
  INVALID_MOVE = "INVALID_MOVE",
  EDGE_ALREADY_TAKEN = "EDGE_ALREADY_TAKEN",
  RESET_FORBIDDEN = "RESET_FORBIDDEN",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export type ErrorPayload = {
  code: ErrorCode;
  message: string;
  metadata?: Record<string, unknown>;
};

export class ContractError extends Error {
  public readonly code: ErrorCode;
  public readonly metadata?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, metadata?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.metadata = metadata;
  }
}

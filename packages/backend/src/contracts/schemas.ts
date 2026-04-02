import { z } from "zod";

const roomIdRegex = /^[a-zA-Z0-9_-]{3,64}$/;

export const pointSchema = z.object({
  row: z.number().int().min(0),
  col: z.number().int().min(0),
});

export const edgeSchema = z.object({
  from: pointSchema,
  to: pointSchema,
});

export const joinRoomSchema = z.object({
  roomId: z.string().regex(roomIdRegex, "roomId must be 3-64 chars [a-zA-Z0-9_-]"),
  rows: z.number().int().min(1).max(12).optional(),
  cols: z.number().int().min(1).max(12).optional(),
  playerId: z.string().min(1).max(128).optional(),
});

export const makeMoveSchema = z.object({
  roomId: z.string().regex(roomIdRegex),
  edge: edgeSchema,
  actionId: z.string().min(3).max(128),
});

export const resetGameSchema = z.object({
  roomId: z.string().regex(roomIdRegex),
});

export const syncStateSchema = z.object({
  roomId: z.string().regex(roomIdRegex),
});

export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type MakeMovePayload = z.infer<typeof makeMoveSchema>;
export type ResetGamePayload = z.infer<typeof resetGameSchema>;
export type SyncStatePayload = z.infer<typeof syncStateSchema>;

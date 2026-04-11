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
}).strict();

export const makeMoveSchema = z.object({
  roomId: z.string().regex(roomIdRegex),
  edge: edgeSchema,
  actionId: z.string().min(3).max(128),
  clientSequence: z.number().int().min(0).optional(),
});

export const resetGameSchema = z.object({
  roomId: z.string().regex(roomIdRegex),
});

export const syncStateSchema = z.object({
  roomId: z.string().regex(roomIdRegex),
});

export const chatMessageSchema = z.object({
  roomId: z.string().regex(roomIdRegex),
  message: z.string().trim().min(1).max(300),
});

// Auth schemas
export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, "username must contain only letters, numbers and underscore"),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(128),
  walletAddress: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(128),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type MakeMovePayload = z.infer<typeof makeMoveSchema>;
export type ResetGamePayload = z.infer<typeof resetGameSchema>;
export type SyncStatePayload = z.infer<typeof syncStateSchema>;
export type ChatMessagePayload = z.infer<typeof chatMessageSchema>;
export type RegisterPayload = z.infer<typeof registerSchema>;
export type LoginPayload = z.infer<typeof loginSchema>;
export type RefreshTokenPayload = z.infer<typeof refreshTokenSchema>;

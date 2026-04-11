import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().default("*"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  PUBLIC_BASE_URL: z.string().url().optional(),
  RECONNECT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(30000),
  DEDUPE_WINDOW_MS: z.coerce.number().int().min(1000).max(300000).default(15000),
  ROOM_SWEEP_INTERVAL_MS: z.coerce.number().int().min(1000).max(300000).default(5000),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default("squarexo-backend"),
  JWT_AUDIENCE: z.string().min(1).default("squarexo-clients"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("30d"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(): AppEnv {
  return envSchema.parse(process.env);
}

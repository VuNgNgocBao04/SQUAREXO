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
  REQUIRE_SOCKET_JWT: z.coerce.boolean().optional(),
  ALLOW_GUEST_SOCKET_IN_DEV: z.coerce.boolean().default(true),
  OASIS_RPC_URL: z.string().url().optional(),
  BACKEND_SIGNER_PRIVATE_KEY: z.string().min(1).optional(),
  CONTRACT_ADDRESS: z.string().min(1).optional(),
  BLOCKCHAIN_SUBMIT_RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  BLOCKCHAIN_SUBMIT_BASE_DELAY_MS: z.coerce.number().int().min(100).max(30000).default(750),
  BLOCKCHAIN_TX_CONFIRMATIONS: z.coerce.number().int().min(1).max(10).default(1),
  BLOCKCHAIN_SUBMIT_TIMEOUT_MS: z.coerce.number().int().min(5000).max(180000).default(45000),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(): AppEnv {
  const parsed = envSchema.parse(process.env);
  return {
    ...parsed,
    REQUIRE_SOCKET_JWT: parsed.REQUIRE_SOCKET_JWT ?? parsed.NODE_ENV === "production",
  };
}

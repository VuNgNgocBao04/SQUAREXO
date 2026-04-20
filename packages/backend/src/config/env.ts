import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const evmAddressRegex = /^0x[a-fA-F0-9]{40}$/;
const evmPrivateKeyRegex = /^(0x)?[a-fA-F0-9]{64}$/;

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
  OASIS_RPC_URL: z.string().url().optional(),
  OASIS_RPC_FALLBACK_URLS: z.string().optional(),
  OASIS_EXPECTED_CHAIN_ID: z.coerce.number().int().positive().default(0x5aff),
  BACKEND_SIGNER_PRIVATE_KEY: z.string().regex(evmPrivateKeyRegex, "Invalid EVM private key").optional(),
  CONTRACT_ADDRESS: z.string().regex(evmAddressRegex, "Invalid contract address").optional(),
  BLOCKCHAIN_TX_TIMEOUT_MS: z.coerce.number().int().min(5000).max(180000).default(45000),
  HISTORY_SYNC_API_KEY: z.string().min(24).optional(),
}).superRefine((value, ctx) => {
  const hasAnyBlockchainField = Boolean(
    value.OASIS_RPC_URL || value.BACKEND_SIGNER_PRIVATE_KEY || value.CONTRACT_ADDRESS,
  );

  if (hasAnyBlockchainField) {
    if (!value.OASIS_RPC_URL) {
      ctx.addIssue({
        path: ["OASIS_RPC_URL"],
        code: z.ZodIssueCode.custom,
        message: "OASIS_RPC_URL is required when blockchain integration is enabled",
      });
    }
    if (!value.BACKEND_SIGNER_PRIVATE_KEY) {
      ctx.addIssue({
        path: ["BACKEND_SIGNER_PRIVATE_KEY"],
        code: z.ZodIssueCode.custom,
        message: "BACKEND_SIGNER_PRIVATE_KEY is required when blockchain integration is enabled",
      });
    }
    if (!value.CONTRACT_ADDRESS) {
      ctx.addIssue({
        path: ["CONTRACT_ADDRESS"],
        code: z.ZodIssueCode.custom,
        message: "CONTRACT_ADDRESS is required when blockchain integration is enabled",
      });
    }
  }
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(): AppEnv {
  return envSchema.parse(process.env);
}

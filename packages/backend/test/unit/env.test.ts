import { afterEach, describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("loadEnv", () => {
  it("loads defaults for optional runtime settings", () => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: "test-secret-key-that-is-long-enough-for-testing",
    };

    const env = loadEnv();

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("test");
    expect(env.CORS_ORIGIN).toBe("*");
    expect(env.JWT_ISSUER).toBe("squarexo-backend");
    expect(env.JWT_AUDIENCE).toBe("squarexo-clients");
    expect(env.JWT_EXPIRES_IN).toBe("7d");
    expect(env.REFRESH_TOKEN_EXPIRES_IN).toBe("30d");
    expect(env.OASIS_EXPECTED_CHAIN_ID).toBe(0x5aff);
    expect(env.BLOCKCHAIN_TX_TIMEOUT_MS).toBe(45000);
  });

  it("accepts blockchain configuration when all required values are present", () => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: "test-secret-key-that-is-long-enough-for-testing",
      OASIS_RPC_URL: "https://testnet.sapphire.oasis.io",
      BACKEND_SIGNER_PRIVATE_KEY: "0x1111111111111111111111111111111111111111111111111111111111111111",
      CONTRACT_ADDRESS: "0x1111111111111111111111111111111111111111",
      OASIS_RPC_FALLBACK_URLS: "https://rpc-1.example,https://rpc-2.example",
      HISTORY_SYNC_API_KEY: "abcdefghijklmnopqrstuvwxyz",
    };

    const env = loadEnv();

    expect(env.OASIS_RPC_URL).toBe("https://testnet.sapphire.oasis.io");
    expect(env.BACKEND_SIGNER_PRIVATE_KEY).toMatch(/^0x/);
    expect(env.CONTRACT_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(env.OASIS_RPC_FALLBACK_URLS).toContain("rpc-2");
    expect(env.HISTORY_SYNC_API_KEY).toBe("abcdefghijklmnopqrstuvwxyz");
  });

  it("rejects partial blockchain configuration", () => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: "test-secret-key-that-is-long-enough-for-testing",
      OASIS_RPC_URL: "https://testnet.sapphire.oasis.io",
    };

    expect(() => loadEnv()).toThrow(/required when blockchain integration is enabled/i);
  });

  it("rejects invalid signer and contract formats", () => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: "test-secret-key-that-is-long-enough-for-testing",
      OASIS_RPC_URL: "https://testnet.sapphire.oasis.io",
      BACKEND_SIGNER_PRIVATE_KEY: "not-a-private-key",
      CONTRACT_ADDRESS: "not-an-address",
    };

    expect(() => loadEnv()).toThrow();
  });
});

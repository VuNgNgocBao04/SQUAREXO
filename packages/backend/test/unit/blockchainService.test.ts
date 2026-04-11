import { describe, expect, it, vi } from "vitest";
import { ethers } from "ethers";
import { BlockchainService } from "../../src/services/blockchainService";
import type { AppEnv } from "../../src/config/env";

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      user: {
        findUnique: vi.fn(),
      },
    },
  };
});

vi.mock("../../src/db/prisma", () => ({
  getPrismaClient: () => mockPrisma,
}));

describe("BlockchainService winner wallet guards", () => {
  const baseEnv: AppEnv = {
    PORT: 3000,
    CORS_ORIGIN: "*",
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-key-that-is-long-enough-for-tests",
    JWT_ISSUER: "squarexo-test-suite",
    JWT_AUDIENCE: "squarexo-test-clients",
    JWT_EXPIRES_IN: "7d",
    REFRESH_TOKEN_EXPIRES_IN: "30d",
    PUBLIC_BASE_URL: "http://localhost:3000",
    RECONNECT_TIMEOUT_MS: 30000,
    DEDUPE_WINDOW_MS: 15000,
    ROOM_SWEEP_INTERVAL_MS: 5000,
    OASIS_RPC_URL: "https://testnet.sapphire.oasis.io",
    BACKEND_SIGNER_PRIVATE_KEY: "0xabc123",
    CONTRACT_ADDRESS: "0x1000000000000000000000000000000000000001",
  };

  it("returns winner_wallet_missing and skips contract call when winner has no wallet", async () => {
    mockPrisma.user.findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "player-x", walletAddress: null })
      .mockResolvedValueOnce({ id: "player-o", walletAddress: "0x2222222222222222222222222222222222222222" });

    const submitResult = vi.fn();
    const service = new BlockchainService(baseEnv) as unknown as {
      contract: { submitResult: typeof submitResult };
      submitResult: BlockchainService["submitResult"];
    };
    service.contract = { submitResult };

    const result = await service.submitResult({
      roomId: "room-1",
      playerXId: "player-x",
      playerOId: "player-o",
      scoreX: 3,
      scoreO: 1,
    });

    expect(result).toEqual({
      submitted: false,
      reason: "winner_wallet_missing",
    });
    expect(submitResult).not.toHaveBeenCalled();
  });

  it("submits ZeroAddress for a tie even when both wallets are missing", async () => {
    mockPrisma.user.findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "player-x", walletAddress: null })
      .mockResolvedValueOnce({ id: "player-o", walletAddress: null });

    const submitResult = vi.fn().mockResolvedValue({
      hash: "0xabc",
      wait: vi.fn().mockResolvedValue({ hash: "0xdef" }),
    });

    const service = new BlockchainService(baseEnv) as unknown as {
      contract: { submitResult: typeof submitResult };
      submitResult: BlockchainService["submitResult"];
    };
    service.contract = { submitResult };

    const result = await service.submitResult({
      roomId: "room-2",
      playerXId: "player-x",
      playerOId: "player-o",
      scoreX: 2,
      scoreO: 2,
    });

    expect(submitResult).toHaveBeenCalledWith("room-2", ethers.ZeroAddress);
    expect(result).toEqual({
      submitted: true,
      txHash: "0xdef",
      winnerWallet: undefined,
    });
  });
});

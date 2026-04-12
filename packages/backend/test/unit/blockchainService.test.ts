import { ethers } from "ethers";
import { describe, expect, it, vi } from "vitest";
import {
  type BlockchainContract,
  BlockchainService,
  createSquarexoContract,
} from "../../src/services/blockchainService";
import type { AppEnv } from "../../src/config/env";

const { wrapEthersSignerMock } = vi.hoisted(() => {
  return {
    wrapEthersSignerMock: vi.fn((wallet: unknown) => wallet),
  };
});

vi.mock("@oasisprotocol/sapphire-ethers-v6", () => ({
  wrapEthersSigner: wrapEthersSignerMock,
}));

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
    BACKEND_SIGNER_PRIVATE_KEY: "0x1111111111111111111111111111111111111111111111111111111111111111",
    CONTRACT_ADDRESS: "0x1000000000000000000000000000000000000001",
  };

  it("wraps the Wallet with Sapphire when creating the contract", async () => {
    const contract = await createSquarexoContract({
      rpcUrl: baseEnv.OASIS_RPC_URL as string,
      privateKey: baseEnv.BACKEND_SIGNER_PRIVATE_KEY as string,
      contractAddress: baseEnv.CONTRACT_ADDRESS as string,
    });

    expect(wrapEthersSignerMock).toHaveBeenCalledTimes(1);
    expect(wrapEthersSignerMock.mock.calls[0]?.[0]).toMatchObject({
      address: expect.any(String),
    });
    expect((contract as { target?: string }).target).toBe(baseEnv.CONTRACT_ADDRESS);
  });

  it("returns winner_wallet_missing and skips contract call when winner has no wallet", async () => {
    mockPrisma.user.findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "player-x", walletAddress: null })
      .mockResolvedValueOnce({ id: "player-o", walletAddress: "0x2222222222222222222222222222222222222222" });

    const submitResult = vi.fn();
    const contractFactory = vi.fn().mockResolvedValue({ submitResult } as unknown as BlockchainContract);
    const service = new BlockchainService(baseEnv, {
      contractFactory,
    });

    expect(contractFactory).toHaveBeenCalledTimes(1);

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
    const contractFactory = vi.fn().mockResolvedValue({ submitResult } as unknown as BlockchainContract);

    const service = new BlockchainService(baseEnv, {
      contractFactory,
    });

    expect(contractFactory).toHaveBeenCalledTimes(1);

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

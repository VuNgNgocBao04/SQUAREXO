import { ethers } from "ethers";
import type { AppEnv } from "../config/env";
import { getPrismaClient } from "../db/prisma";
import { logger } from "../config/logger";
import { metrics } from "../observability/metrics";

type SapphireWrapApi = {
  wrapEthereumProvider: <T extends { request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown> }>(
    upstream: T,
  ) => T;
};

const sapphire = require("@oasisprotocol/sapphire-paratime") as SapphireWrapApi;

const squarexoMatchAbi = [
  "function submitResult(string roomId, address winner) external",
] as const;

export type SubmitResultInput = {
  roomId: string;
  playerXId: string;
  playerOId: string;
  scoreX: number;
  scoreO: number;
};

export type SubmitResultOutput = {
  submitted: boolean;
  txHash?: string;
  winnerWallet?: string;
  reason?: string;
};

export class BlockchainService {
  private readonly prisma = getPrismaClient();
  private readonly enabled: boolean;
  private readonly contract?: ethers.Contract;
  private readonly retryMaxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly txConfirmations: number;
  private readonly submitTimeoutMs: number;
  private readonly inFlightByRoom = new Map<string, Promise<SubmitResultOutput>>();
  private readonly settledCacheByRoom = new Map<string, SubmitResultOutput>();

  constructor(env: AppEnv) {
    this.retryMaxAttempts = env.BLOCKCHAIN_SUBMIT_RETRY_MAX_ATTEMPTS;
    this.baseDelayMs = env.BLOCKCHAIN_SUBMIT_BASE_DELAY_MS;
    this.txConfirmations = env.BLOCKCHAIN_TX_CONFIRMATIONS;
    this.submitTimeoutMs = env.BLOCKCHAIN_SUBMIT_TIMEOUT_MS;

    const hasValidPrivateKey =
      typeof env.BACKEND_SIGNER_PRIVATE_KEY === "string" && /^0x[a-fA-F0-9]{64}$/.test(env.BACKEND_SIGNER_PRIVATE_KEY);
    const ready = Boolean(env.OASIS_RPC_URL && hasValidPrivateKey && env.CONTRACT_ADDRESS);
    this.enabled = ready;

    if (!ready) {
      if (env.BACKEND_SIGNER_PRIVATE_KEY && !hasValidPrivateKey) {
        logger.warn("blockchain_signer_invalid_private_key_format");
      }
      return;
    }

    const rpcUrl = env.OASIS_RPC_URL as string;
    const privateKey = env.BACKEND_SIGNER_PRIVATE_KEY as string;
    const contractAddress = env.CONTRACT_ADDRESS as string;

    const upstreamProvider = new ethers.JsonRpcProvider(rpcUrl);
    const wrappedProvider = sapphire.wrapEthereumProvider({
      request: async ({ method, params }) => upstreamProvider.send(method, Array.isArray(params) ? params : []),
    });

    const provider = new ethers.BrowserProvider(wrappedProvider);
    const signer = new ethers.NonceManager(new ethers.Wallet(privateKey, provider));
    this.contract = new ethers.Contract(contractAddress, squarexoMatchAbi, signer);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async submitResult(input: SubmitResultInput): Promise<SubmitResultOutput> {
    const settled = this.settledCacheByRoom.get(input.roomId);
    if (settled) {
      return settled;
    }

    const inFlight = this.inFlightByRoom.get(input.roomId);
    if (inFlight) {
      return inFlight;
    }

    const submitPromise = this.submitResultInternal(input).finally(() => {
      this.inFlightByRoom.delete(input.roomId);
    });
    this.inFlightByRoom.set(input.roomId, submitPromise);

    return submitPromise;
  }

  private async submitResultInternal(input: SubmitResultInput): Promise<SubmitResultOutput> {
    if (!this.enabled || !this.contract) {
      return {
        submitted: false,
        reason: "blockchain_not_configured",
      };
    }

    if (!this.prisma) {
      return {
        submitted: false,
        reason: "database_unavailable",
      };
    }

    const [playerX, playerO] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: input.playerXId } }),
      this.prisma.user.findUnique({ where: { id: input.playerOId } }),
    ]);

    const xWallet = playerX?.walletAddress ?? undefined;
    const oWallet = playerO?.walletAddress ?? undefined;

    const winnerWallet =
      input.scoreX > input.scoreO
        ? xWallet
        : input.scoreO > input.scoreX
          ? oWallet
          : ethers.ZeroAddress;

    if (input.scoreX !== input.scoreO && !winnerWallet) {
      return {
        submitted: false,
        reason: "winner_wallet_missing",
      };
    }

    const winnerAddress = winnerWallet ?? ethers.ZeroAddress;

    try {
      const chainResult = await this.submitOnChainWithRetry(input.roomId, winnerAddress);
      const result: SubmitResultOutput = {
        ...chainResult,
        winnerWallet: winnerAddress !== ethers.ZeroAddress ? winnerAddress : undefined,
      };

      if (result.submitted) {
        this.settledCacheByRoom.set(input.roomId, result);
        if (this.settledCacheByRoom.size > 1000) {
          const oldestKey = this.settledCacheByRoom.keys().next().value;
          if (typeof oldestKey === "string") {
            this.settledCacheByRoom.delete(oldestKey);
          }
        }
      }

      return result;
    } catch (error) {
      metrics.incrementBlockchainSubmitFailure();
      throw error;
    }
  }

  private async submitOnChainWithRetry(roomId: string, winnerWallet: string): Promise<SubmitResultOutput> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.retryMaxAttempts; attempt += 1) {
      try {
        const provider = this.contract?.runner?.provider ?? null;
        const feeData =
          provider && "getFeeData" in provider
            ? await this.withTimeout((provider as ethers.Provider).getFeeData(), "get_fee_data")
            : null;

        const estimatedGas = await this.withTimeout(
          this.contract!.submitResult.estimateGas(roomId, winnerWallet),
          "estimate_submit_result_gas",
        );

        const tx = (await this.withTimeout(
          this.contract!.submitResult(roomId, winnerWallet, {
            gasLimit: (estimatedGas * 120n) / 100n,
            maxFeePerGas: feeData?.maxFeePerGas ?? undefined,
            maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas ?? undefined,
          }),
          "submit_result_tx_send",
        )) as ethers.TransactionResponse;

        const receipt = (await this.withTimeout(
          tx.wait(this.txConfirmations),
          "submit_result_tx_wait",
        )) as ethers.TransactionReceipt | null;
        metrics.incrementBlockchainSubmitSuccess();
        return {
          submitted: true,
          txHash: receipt?.hash ?? tx.hash,
        };
      } catch (error) {
        lastError = error;
        const retryable = this.isRetryableError(error);

        logger.warn("submit_result_attempt_failed", {
          roomId,
          attempt,
          retryable,
          error: this.toErrorMessage(error),
        });

        if (!retryable || attempt >= this.retryMaxAttempts) {
          break;
        }

        metrics.incrementBlockchainSubmitRetry();
        const delayMs = this.computeBackoffDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError instanceof Error ? lastError : new Error("submit_result_failed_after_retries");
  }

  private computeBackoffDelay(attempt: number): number {
    const jitter = Math.floor(Math.random() * 250);
    return this.baseDelayMs * 2 ** (attempt - 1) + jitter;
  }

  private isRetryableError(error: unknown): boolean {
    if (!error) {
      return false;
    }

    const msg = this.toErrorMessage(error).toLowerCase();
    const code = typeof error === "object" && error && "code" in error ? String((error as any).code) : "";

    if (code === "NETWORK_ERROR" || code === "SERVER_ERROR" || code === "TIMEOUT") {
      return true;
    }

    return (
      msg.includes("timeout") ||
      msg.includes("network") ||
      msg.includes("temporarily") ||
      msg.includes("rate limit") ||
      msg.includes("already known") ||
      msg.includes("replacement fee too low") ||
      msg.includes("nonce too low") ||
      msg.includes("underpriced")
    );
  }

  private async withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label}_timeout`));
        }, this.submitTimeoutMs);
      });

      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}

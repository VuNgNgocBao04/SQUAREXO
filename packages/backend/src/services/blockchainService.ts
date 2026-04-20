import { ZeroAddress, isAddress } from "ethers";
import type { AppEnv } from "../config/env";
import { logger } from "../config/logger";
import { getPrismaClient } from "../db/prisma";

const squarexoMatchAbi = [
  "function submitResult(string roomId, address winner) external",
] as const;

type BlockchainContractConfig = {
  rpcUrls: string[];
  privateKey: string;
  contractAddress: string;
  expectedChainId: number;
};

type BlockchainTransactionReceipt = {
  hash?: string;
};

type BlockchainTransaction = {
  hash: string;
  wait(): Promise<BlockchainTransactionReceipt | null | undefined>;
};

export type BlockchainContract = {
  submitResult(roomId: string, winner: string): Promise<BlockchainTransaction>;
};

export type BlockchainServiceDeps = {
  prisma?: ReturnType<typeof getPrismaClient>;
  contractFactory?: (config: BlockchainContractConfig) => Promise<BlockchainContract>;
};

export async function createSquarexoContract(
  config: BlockchainContractConfig,
): Promise<BlockchainContract> {
  const ethersModule = await import("ethers");
  const providers = config.rpcUrls.map((rpcUrl) => new ethersModule.JsonRpcProvider(rpcUrl, config.expectedChainId));
  const provider = providers.length === 1 ? providers[0] : new ethersModule.FallbackProvider(providers);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== config.expectedChainId) {
    throw new Error(`Unexpected chain id ${network.chainId.toString()}; expected ${config.expectedChainId}`);
  }

  const wallet = new ethersModule.Wallet(config.privateKey, provider);
  const sapphire = await import("@oasisprotocol/sapphire-ethers-v6");
  const signer = sapphire.wrapEthersSigner(wallet);
  return new ethersModule.Contract(config.contractAddress, squarexoMatchAbi, signer) as unknown as BlockchainContract;
}

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
  private readonly prisma: ReturnType<typeof getPrismaClient>;
  private readonly enabled: boolean;
  private readonly contractPromise?: Promise<BlockchainContract>;
  private readonly txTimeoutMs: number;

  constructor(env: AppEnv, deps: BlockchainServiceDeps = {}) {
    const ready = Boolean(env.OASIS_RPC_URL && env.BACKEND_SIGNER_PRIVATE_KEY && env.CONTRACT_ADDRESS);
    this.enabled = ready;
    this.prisma = deps.prisma ?? getPrismaClient();
    this.txTimeoutMs = env.BLOCKCHAIN_TX_TIMEOUT_MS;

    if (!ready) {
      return;
    }

    const fallbackUrls = (env.OASIS_RPC_FALLBACK_URLS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const rpcUrls = [...new Set([env.OASIS_RPC_URL as string, ...fallbackUrls])];

    const contractFactory = deps.contractFactory ?? createSquarexoContract;
    this.contractPromise = contractFactory({
      rpcUrls,
      privateKey: env.BACKEND_SIGNER_PRIVATE_KEY as string,
      contractAddress: env.CONTRACT_ADDRESS as string,
      expectedChainId: env.OASIS_EXPECTED_CHAIN_ID,
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private async getContract(): Promise<BlockchainContract | undefined> {
    if (!this.enabled || !this.contractPromise) {
      return undefined;
    }

    return this.contractPromise;
  }

  async submitResult(input: SubmitResultInput): Promise<SubmitResultOutput> {
    const contract = await this.getContract();
    if (!this.enabled || !contract) {
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

    let winnerWallet: string;
    if (input.scoreX === input.scoreO) {
      winnerWallet = ZeroAddress;
    } else {
      const candidate = input.scoreX > input.scoreO ? xWallet : oWallet;
      if (!candidate) {
        return {
          submitted: false,
          reason: "winner_wallet_missing",
        };
      }
      if (!isAddress(candidate)) {
        return {
          submitted: false,
          reason: "winner_wallet_invalid",
        };
      }
      winnerWallet = candidate;
    }

    try {
      const submitStartedAt = Date.now();
      const tx = await contract.submitResult(input.roomId, winnerWallet);
      const receipt = await Promise.race([
        tx.wait(),
        new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error("blockchain_tx_confirmation_timeout")), this.txTimeoutMs);
        }),
      ]);

      const waitMs = Date.now() - submitStartedAt;
      if (waitMs > 30000) {
        logger.warn("blockchain_submit_result_slow", {
          roomId: input.roomId,
          waitMs,
          txHash: receipt?.hash ?? tx.hash,
        });
      }

      return {
        submitted: true,
        txHash: receipt?.hash ?? tx.hash,
        winnerWallet: winnerWallet && winnerWallet !== ZeroAddress ? winnerWallet : undefined,
      };
    } catch (error) {
      logger.error("blockchain_submit_result_failed", {
        roomId: input.roomId,
        error: error instanceof Error ? error.message : "unknown_error",
      });

      return {
        submitted: false,
        reason: error instanceof Error ? error.message : "blockchain_submit_failed",
      };
    }
  }
}

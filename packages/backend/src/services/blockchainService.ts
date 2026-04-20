import { ZeroAddress } from "ethers";
import type { AppEnv } from "../config/env";
import { getPrismaClient } from "../db/prisma";

const squarexoMatchAbi = [
  "function submitResult(string roomId, address winner) external",
] as const;

type BlockchainContractConfig = {
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
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
  const provider = new ethersModule.JsonRpcProvider(config.rpcUrl);
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

  constructor(env: AppEnv, deps: BlockchainServiceDeps = {}) {
    const ready = Boolean(env.OASIS_RPC_URL && env.BACKEND_SIGNER_PRIVATE_KEY && env.CONTRACT_ADDRESS);
    this.enabled = ready;
    this.prisma = deps.prisma ?? getPrismaClient();

    if (!ready) {
      return;
    }

    const contractFactory = deps.contractFactory ?? createSquarexoContract;
    this.contractPromise = contractFactory({
      rpcUrl: env.OASIS_RPC_URL as string,
      privateKey: env.BACKEND_SIGNER_PRIVATE_KEY as string,
      contractAddress: env.CONTRACT_ADDRESS as string,
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
      winnerWallet = candidate;
    }

    const tx = await contract.submitResult(input.roomId, winnerWallet);
    const receipt = await tx.wait();

    return {
      submitted: true,
      txHash: receipt?.hash ?? tx.hash,
      winnerWallet: winnerWallet && winnerWallet !== ZeroAddress ? winnerWallet : undefined,
    };
  }
}

import { ethers } from "ethers";
import type { AppEnv } from "../config/env";
import { getPrismaClient } from "../db/prisma";
// @ts-ignore - Node16 CommonJS build resolves this package via its CJS export at runtime.
import * as sapphire from "@oasisprotocol/sapphire-paratime";

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

  constructor(env: AppEnv) {
    const ready = Boolean(env.OASIS_RPC_URL && env.BACKEND_SIGNER_PRIVATE_KEY && env.CONTRACT_ADDRESS);
    this.enabled = ready;

    if (!ready) {
      return;
    }

    const rpcUrl = env.OASIS_RPC_URL as string;
    const privateKey = env.BACKEND_SIGNER_PRIVATE_KEY as string;
    const contractAddress = env.CONTRACT_ADDRESS as string;

    const upstreamProvider = new ethers.JsonRpcProvider(rpcUrl);
    const provider = new ethers.BrowserProvider(
      sapphire.wrapEthereumProvider({
        request: async ({ method, params }) => upstreamProvider.send(method, params as never),
      }),
    );
    const signer = new ethers.Wallet(privateKey, provider);
    this.contract = new ethers.Contract(contractAddress, squarexoMatchAbi, signer);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async submitResult(input: SubmitResultInput): Promise<SubmitResultOutput> {
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

    const tx = await this.contract.submitResult(input.roomId, winnerWallet);
    const receipt = await tx.wait();

    return {
      submitted: true,
      txHash: receipt?.hash ?? tx.hash,
      winnerWallet: winnerWallet && winnerWallet !== ethers.ZeroAddress ? winnerWallet : undefined,
    };
  }
}

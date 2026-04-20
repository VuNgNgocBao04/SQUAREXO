import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "../db/prisma";
import { calculateElo, type MatchOutcome } from "./eloService";
import type { Edge } from "../types/gameCore";

type SaveMatchMoveInput = {
  moveIndex: number;
  edge: Edge;
  player: "X" | "O";
  timestamp?: Date;
};

export type SaveMatchResultInput = {
  roomId: string;
  playerXId: string;
  playerOId: string;
  boardRows: number;
  boardCols: number;
  totalMoves: number;
  scoreX: number;
  scoreO: number;
  startedAt: Date;
  endedAt: Date;
  betAmount?: number;
  txHash?: string;
  moves?: SaveMatchMoveInput[];
};

export type HistorySyncItem = {
  roomId: string;
  playerX?: string;
  playerO?: string;
  winnerPlayer: "X" | "O" | "draw";
  scoreX: number;
  scoreO: number;
  totalMoves: number;
  gridSize: number;
  gameMode: "pvp" | "ai";
  stakeRose: number;
  txHash?: string;
  startedAt?: string;
  endedAt: string;
};

type InMemoryMatch = {
  id: string;
  roomId: string;
  playerXId: string;
  playerOId: string;
  winner: "X" | "O" | "DRAW";
  winnerUserId?: string;
  boardRows: number;
  boardCols: number;
  totalMoves: number;
  betAmount?: number;
  txHash?: string;
  startedAt: Date;
  endedAt: Date;
  createdAt: Date;
  moves: SaveMatchMoveInput[];
};

const inMemoryMatches = new Map<string, InMemoryMatch>();

export class MatchService {
  private readonly prisma = getPrismaClient();

  private toWinnerSymbol(winner: HistorySyncItem["winnerPlayer"]): "X" | "O" | "DRAW" {
    if (winner === "draw") {
      return "DRAW";
    }

    return winner;
  }

  private buildSyntheticEmail(seed: string): string {
    return `${seed.toLowerCase().replace(/[^a-z0-9_]/g, "")}_${randomUUID()}@local.squarexo`;
  }

  private async ensureUserByWallet(walletAddress: string): Promise<string | null> {
    if (!this.prisma) {
      return null;
    }

    const normalized = walletAddress.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { walletAddress: normalized } });
    if (existing) {
      return existing.id;
    }

    const seed = normalized.slice(2, 10);
    const created = await this.prisma.user.create({
      data: {
        username: `wallet_${seed}_${Date.now().toString().slice(-6)}`,
        email: this.buildSyntheticEmail(`wallet_${seed}`),
        passwordHash: `wallet-auth-disabled:${seed}`,
        walletAddress: normalized,
      },
    });

    return created.id;
  }

  private async ensureSyntheticOpponent(label: "bot" | "opponent"): Promise<string | null> {
    if (!this.prisma) {
      return null;
    }

    const username = `squarexo_${label}`;
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      return existing.id;
    }

    const created = await this.prisma.user.create({
      data: {
        username,
        email: this.buildSyntheticEmail(username),
        passwordHash: `synthetic-user:${label}`,
      },
    });

    return created.id;
  }

  private resolveWinner(scoreX: number, scoreO: number): MatchOutcome {
    if (scoreX > scoreO) return "X";
    if (scoreO > scoreX) return "O";
    return "DRAW";
  }

  async saveResult(input: SaveMatchResultInput): Promise<{ id: string }> {
    const winner = this.resolveWinner(input.scoreX, input.scoreO);
    const winnerUserId =
      winner === "X" ? input.playerXId : winner === "O" ? input.playerOId : undefined;

    if (!this.prisma) {
      const id = randomUUID();
      inMemoryMatches.set(id, {
        id,
        roomId: input.roomId,
        playerXId: input.playerXId,
        playerOId: input.playerOId,
        winner,
        winnerUserId,
        boardRows: input.boardRows,
        boardCols: input.boardCols,
        totalMoves: input.totalMoves,
        betAmount: input.betAmount,
        txHash: input.txHash,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        createdAt: new Date(),
        moves: input.moves ?? [],
      });
      return { id };
    }

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const [playerX, playerO] = await Promise.all([
        tx.user.findUnique({ where: { id: input.playerXId } }),
        tx.user.findUnique({ where: { id: input.playerOId } }),
      ]);

      if (!playerX || !playerO) {
        throw new Error("Cannot save match because one or more players are missing");
      }

      const nextElo = calculateElo(playerX.elo, playerO.elo, winner);

      await Promise.all([
        tx.user.update({ where: { id: input.playerXId }, data: { elo: nextElo.xElo } }),
        tx.user.update({ where: { id: input.playerOId }, data: { elo: nextElo.oElo } }),
      ]);

      const created = await tx.match.create({
        data: {
          roomId: input.roomId,
          playerXId: input.playerXId,
          playerOId: input.playerOId,
          winner,
          winnerUserId,
          boardRows: input.boardRows,
          boardCols: input.boardCols,
          totalMoves: input.totalMoves,
          betAmount: input.betAmount,
          txHash: input.txHash,
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          moves: input.moves && input.moves.length > 0
            ? {
              create: input.moves.map((move) => ({
                moveIndex: move.moveIndex,
                edge: move.edge as unknown as Prisma.InputJsonValue,
                player: move.player,
                createdAt: move.timestamp ?? new Date(),
              })),
            }
            : undefined,
        },
      });

      return created;
    });

    return { id: result.id };
  }

  async getMatchById(matchId: string) {
    if (!this.prisma) {
      const match = inMemoryMatches.get(matchId);
      if (!match) {
        return null;
      }

      return {
        ...match,
        playerX: { id: match.playerXId, username: "playerX" },
        playerO: { id: match.playerOId, username: "playerO" },
      };
    }

    return this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        playerX: { select: { id: true, username: true, avatarUrl: true, walletAddress: true } },
        playerO: { select: { id: true, username: true, avatarUrl: true, walletAddress: true } },
        moves: {
          orderBy: { moveIndex: "asc" },
        },
      },
    });
  }

  async getUserMatches(userId: string, page: number, limit: number) {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    if (!this.prisma) {
      const all = [...inMemoryMatches.values()]
        .filter((m) => m.playerXId === userId || m.playerOId === userId)
        .sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime());
      const items = all.slice(skip, skip + safeLimit);
      return {
        items,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total: all.length,
          totalPages: Math.ceil(all.length / safeLimit),
        },
      };
    }

    const where = {
      OR: [{ playerXId: userId }, { playerOId: userId }],
    };

    const [items, total] = await Promise.all([
      this.prisma.match.findMany({
        where,
        orderBy: { endedAt: "desc" },
        skip,
        take: safeLimit,
        include: {
          playerX: { select: { id: true, username: true, avatarUrl: true } },
          playerO: { select: { id: true, username: true, avatarUrl: true } },
        },
      }),
      this.prisma.match.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async getWalletHistory(walletAddress: string, page: number, limit: number) {
    if (!this.prisma) {
      return {
        items: [] as Array<unknown>,
        pagination: {
          page: 1,
          limit: Math.min(Math.max(limit, 1), 100),
          total: 0,
          totalPages: 0,
        },
      };
    }

    const user = await this.prisma.user.findUnique({ where: { walletAddress: walletAddress.toLowerCase() } });
    if (!user) {
      return {
        items: [] as Array<unknown>,
        pagination: {
          page: Math.max(page, 1),
          limit: Math.min(Math.max(limit, 1), 100),
          total: 0,
          totalPages: 0,
        },
      };
    }

    return this.getUserMatches(user.id, page, limit);
  }

  async syncWalletHistory(walletAddress: string, items: HistorySyncItem[]): Promise<{ upserted: number }> {
    if (!this.prisma || items.length === 0) {
      return { upserted: 0 };
    }

    const ownerId = await this.ensureUserByWallet(walletAddress);
    if (!ownerId) {
      return { upserted: 0 };
    }

    const botId = await this.ensureSyntheticOpponent("bot");
    const opponentId = await this.ensureSyntheticOpponent("opponent");
    if (!botId || !opponentId) {
      return { upserted: 0 };
    }

    let upserted = 0;
    for (const item of items) {
      const endedAt = new Date(item.endedAt);
      const startedAt = item.startedAt ? new Date(item.startedAt) : new Date(endedAt.getTime() - 60_000);
      if (Number.isNaN(endedAt.getTime()) || Number.isNaN(startedAt.getTime())) {
        continue;
      }

      const winner = this.toWinnerSymbol(item.winnerPlayer);
      const localOpponentId = item.gameMode === "ai" ? botId : opponentId;
      const winnerUserId = winner === "X" ? ownerId : winner === "O" ? localOpponentId : null;

      const duplicate = await this.prisma.match.findFirst({
        where: {
          roomId: item.roomId,
          playerXId: ownerId,
          playerOId: localOpponentId,
          endedAt,
        },
        select: { id: true },
      });

      if (duplicate) {
        continue;
      }

      await this.prisma.match.create({
        data: {
          roomId: item.roomId,
          playerXId: ownerId,
          playerOId: localOpponentId,
          winner,
          winnerUserId,
          boardRows: item.gridSize,
          boardCols: item.gridSize,
          totalMoves: item.totalMoves,
          betAmount: new Prisma.Decimal(item.stakeRose),
          txHash: item.txHash,
          startedAt,
          endedAt,
        },
      });

      upserted += 1;
    }

    return { upserted };
  }
}

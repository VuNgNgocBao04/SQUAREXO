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
                edge: move.edge,
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
}

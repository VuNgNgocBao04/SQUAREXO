import { randomUUID } from "node:crypto";
import { getPrismaClient } from "../db/prisma";
import { UserStoreError, userStore } from "../store/userStore";

export type UserProfile = {
  id: string;
  username: string;
  email: string;
  walletAddress?: string;
  avatarUrl?: string;
  elo: number;
  rank: string;
  createdAt: Date;
  stats: {
    wins: number;
    losses: number;
    draws: number;
    totalMatches: number;
    winRate: number;
  };
};

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  walletAddress?: string;
  avatarUrl?: string;
  role: "user" | "admin";
  elo: number;
  createdAt: Date;
  updatedAt: Date;
};

export type RegisterUserInput = {
  username: string;
  email: string;
  passwordHash: string;
  walletAddress?: string;
  avatarUrl?: string;
};

export class UserService {
  private readonly prisma = getPrismaClient();

  private isPrismaUniqueError(error: unknown): boolean {
    return !!(
      typeof error === "object"
      && error
      && "code" in error
      && (error as { code?: string }).code === "P2002"
    );
  }

  private toRank(elo: number): string {
    if (elo >= 2000) return "Master";
    if (elo >= 1700) return "Diamond";
    if (elo >= 1400) return "Gold";
    if (elo >= 1200) return "Silver";
    return "Bronze";
  }

  private fromPrismaUser(user: {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    walletAddress: string | null;
    avatarUrl: string | null;
    elo: number;
    createdAt: Date;
    updatedAt: Date;
  }): AuthUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      passwordHash: user.passwordHash,
      walletAddress: user.walletAddress ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      role: "user",
      elo: user.elo,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async createUser(input: RegisterUserInput): Promise<AuthUser> {
    if (!this.prisma) {
      // Check for duplicates before creating to prevent race conditions
      if (userStore.findByEmail(input.email)) {
        throw new UserStoreError("USER_EXISTS_EMAIL", `User with email ${input.email} already exists`);
      }
      if (userStore.findByUsername(input.username)) {
        throw new UserStoreError("USER_EXISTS_USERNAME", `User with username ${input.username} already exists`);
      }

      const user = userStore.createUser({
        id: randomUUID(),
        username: input.username,
        email: input.email,
        passwordHash: input.passwordHash,
        role: "user",
        walletAddress: input.walletAddress,
        avatarUrl: input.avatarUrl,
        elo: 1000,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { ...user, elo: user.elo ?? 1000 };
    }

    try {
      const created = await this.prisma.user.create({
        data: {
          username: input.username,
          email: input.email,
          passwordHash: input.passwordHash,
          walletAddress: input.walletAddress,
          avatarUrl: input.avatarUrl,
        },
      });
      return this.fromPrismaUser(created);
    } catch (error) {
      if (this.isPrismaUniqueError(error)) {
        throw new UserStoreError("USER_EXISTS_USERNAME", "User already exists");
      }
      throw error;
    }
  }

  async findById(userId: string): Promise<AuthUser | null> {
    if (!this.prisma) {
      const user = userStore.findById(userId);
      if (!user) {
        return null;
      }
      return { ...user, elo: user.elo ?? 1000 };
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? this.fromPrismaUser(user) : null;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    if (!this.prisma) {
      const user = userStore.findByEmail(email);
      if (!user) {
        return null;
      }
      return { ...user, elo: user.elo ?? 1000 };
    }

    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return user ? this.fromPrismaUser(user) : null;
  }

  async findByUsername(username: string): Promise<AuthUser | null> {
    if (!this.prisma) {
      const user = userStore.findByUsername(username);
      if (!user) {
        return null;
      }
      return { ...user, elo: user.elo ?? 1000 };
    }

    const user = await this.prisma.user.findUnique({ where: { username } });
    return user ? this.fromPrismaUser(user) : null;
  }

  async findByIdentifier(identifier: string): Promise<AuthUser | null> {
    const byEmail = await this.findByEmail(identifier);
    if (byEmail) {
      return byEmail;
    }
    return this.findByUsername(identifier);
  }

  async updateElo(userId: string, nextElo: number): Promise<void> {
    if (!this.prisma) {
      const user = userStore.findById(userId);
      if (!user) {
        return;
      }
      userStore.updateUser({ ...user, elo: nextElo, updatedAt: new Date() });
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { elo: nextElo },
    });
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.findById(userId);
    if (!user) {
      return null;
    }

    const stats = await this.getStats(userId);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      walletAddress: user.walletAddress,
      avatarUrl: user.avatarUrl,
      elo: user.elo,
      rank: this.toRank(user.elo),
      createdAt: user.createdAt,
      stats,
    };
  }

  private computeStats(
    matches: Array<{ winner: "X" | "O" | "DRAW" | null; playerXId: string; playerOId: string }>,
    userId: string,
  ) {
    let wins = 0;
    let losses = 0;
    let draws = 0;

    for (const match of matches) {
      if (!match.winner || match.winner === "DRAW") {
        draws += 1;
      } else {
        const isWinner =
          (match.winner === "X" && match.playerXId === userId)
          || (match.winner === "O" && match.playerOId === userId);
        if (isWinner) {
          wins += 1;
        } else {
          losses += 1;
        }
      }
    }

    const totalMatches = matches.length;

    return {
      wins,
      losses,
      draws,
      totalMatches,
      winRate: totalMatches === 0 ? 0 : Number(((wins / totalMatches) * 100).toFixed(2)),
    };
  }

  async getStats(userId: string): Promise<UserProfile["stats"]> {
    if (!this.prisma) {
      return {
        wins: 0,
        losses: 0,
        draws: 0,
        totalMatches: 0,
        winRate: 0,
      };
    }

    const matches = await this.prisma.match.findMany({
      where: {
        OR: [{ playerXId: userId }, { playerOId: userId }],
      },
    });

    return this.computeStats(matches as Array<{
      winner: "X" | "O" | "DRAW" | null;
      playerXId: string;
      playerOId: string;
    }>, userId);
  }
}

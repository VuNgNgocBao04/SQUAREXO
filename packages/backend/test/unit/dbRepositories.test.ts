import { describe, expect, it } from "vitest";
import type { QueryResult, QueryResultRow } from "pg";
import type { DatabaseConnection } from "../../src/db/client";
import { RefreshTokenRepository } from "../../src/db/refreshTokenRepository";
import { TokenRevocationRepository } from "../../src/db/tokenRevocationRepository";
import { UserRepository } from "../../src/db/userRepository";
import type { User } from "../../src/types/auth";

class FakeDb implements DatabaseConnection {
  calls: Array<{ sql: string; values?: any[] }> = [];

  constructor(private results: Array<Partial<QueryResult<any>>> = []) {}

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, values?: any[]): Promise<QueryResult<T>> {
    this.calls.push({ sql, values });
    const result = this.results.shift() ?? { rows: [], rowCount: 0 };
    return {
      command: "SELECT",
      oid: 0,
      fields: [],
      rowCount: result.rowCount ?? result.rows?.length ?? 0,
      rows: (result.rows ?? []) as T[],
    };
  }

  async close(): Promise<void> {}
}

const user: User = {
  id: "9c21b37a-c636-4a32-9366-e25a90ba0f0f",
  username: "testuser",
  email: "test@example.com",
  passwordHash: "hash",
  role: "user",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("database repositories", () => {
  it("maps user rows and normalizes lookup fields", async () => {
    const db = new FakeDb([
      { rows: [user] },
      { rows: [user] },
      { rows: [user] },
      { rows: [user] },
      { rows: [user] },
      { rowCount: 1 },
      { rows: [[user][0]] },
      { rowCount: 1 },
    ]);
    const repo = new UserRepository(db);

    await expect(repo.createUser(user)).resolves.toEqual(user);
    await expect(repo.findById(user.id)).resolves.toEqual(user);
    await expect(repo.findByEmail("TEST@EXAMPLE.COM")).resolves.toEqual(user);
    await expect(repo.findByUsername("TestUser")).resolves.toEqual(user);
    await expect(repo.updateUser(user)).resolves.toEqual(user);
    await expect(repo.deleteUser(user.id)).resolves.toBeUndefined();
    await expect(repo.getAllUsers()).resolves.toEqual([user]);
    await expect(repo.updateLastLogin(user.id)).resolves.toBeUndefined();

    expect(db.calls[0].sql).toContain('password_hash as "passwordHash"');
    expect(db.calls[2].values).toEqual(["test@example.com"]);
    expect(db.calls[3].values).toEqual(["testuser"]);
  });

  it("handles refresh token persistence operations", async () => {
    const token = {
      id: "token-id",
      userId: user.id,
      jti: "jti",
      tokenFamily: "family",
      isRevoked: false,
      expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const db = new FakeDb([
      { rows: [token] },
      { rows: [{ count: "1" }] },
      { rowCount: 1 },
      { rowCount: 1 },
      { rows: [token] },
      { rows: [token] },
      { rowCount: 2 },
      { rowCount: 1 },
    ]);
    const repo = new RefreshTokenRepository(db);

    await expect(repo.storeRefreshToken(user.id, "jti", "family", token.expiresAt)).resolves.toEqual(token);
    await expect(repo.isRefreshTokenValid("jti")).resolves.toBe(true);
    await expect(repo.revokeRefreshToken("jti")).resolves.toBeUndefined();
    await expect(repo.revokeTokenFamily("family")).resolves.toBeUndefined();
    await expect(repo.getRefreshToken("jti")).resolves.toEqual(token);
    await expect(repo.getUserRefreshTokens(user.id)).resolves.toEqual([token]);
    await expect(repo.cleanupExpiredTokens()).resolves.toBe(2);
    await expect(repo.revokeAllUserTokens(user.id)).resolves.toBeUndefined();
  });

  it("handles token revocation operations", async () => {
    const revoked = {
      id: "revocation-id",
      userId: user.id,
      jti: "jti",
      tokenType: "refresh",
      revokedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-02-01T00:00:00.000Z"),
    };
    const db = new FakeDb([
      { rowCount: 1 },
      { rows: [{ count: "1" }] },
      { rows: [revoked] },
      { rowCount: 3 },
    ]);
    const repo = new TokenRevocationRepository(db);

    await expect(repo.revokeToken(user.id, "jti", "refresh", revoked.expiresAt, "logout")).resolves.toBeUndefined();
    await expect(repo.isTokenRevoked("jti")).resolves.toBe(true);
    await expect(repo.getUserRevokedTokens(user.id)).resolves.toEqual([revoked]);
    await expect(repo.cleanupExpiredRevocations()).resolves.toBe(3);
  });
});

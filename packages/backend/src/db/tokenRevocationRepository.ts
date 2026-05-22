import type { DatabaseConnection } from "./client";

export interface RevokedToken {
  id: string;
  userId: string;
  jti: string;
  tokenType: string;
  reason?: string;
  revokedAt: Date;
  expiresAt: Date;
}

export class TokenRevocationRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Revoke a token by its JTI (JWT ID)
   */
  async revokeToken(userId: string, jti: string, tokenType: string, expiresAt: Date, reason?: string): Promise<void> {
    await this.db.query(
      `INSERT INTO token_revocations (user_id, jti, token_type, reason, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (jti) DO UPDATE SET revoked_at = CURRENT_TIMESTAMP`,
      [userId, jti, tokenType, reason || null, expiresAt],
    );
  }

  /**
   * Check if a token is revoked
   */
  async isTokenRevoked(jti: string): Promise<boolean> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM token_revocations WHERE jti = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [jti],
    );
    return Number(result.rows[0]?.count ?? 0) > 0;
  }

  /**
   * Get all revoked tokens for a user
   */
  async getUserRevokedTokens(userId: string): Promise<RevokedToken[]> {
    const result = await this.db.query<RevokedToken>(
      `SELECT id, user_id as "userId", jti, token_type as "tokenType", reason, revoked_at as "revokedAt", expires_at as "expiresAt"
       FROM token_revocations
       WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
       ORDER BY revoked_at DESC`,
      [userId],
    );
    return result.rows;
  }

  /**
   * Cleanup expired revocations (run periodically)
   */
  async cleanupExpiredRevocations(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM token_revocations WHERE expires_at < CURRENT_TIMESTAMP`,
    );
    return result.rowCount || 0;
  }
}

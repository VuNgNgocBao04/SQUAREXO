import type { DatabaseConnection } from "./client";

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  jti: string;
  tokenFamily: string;
  isRevoked: boolean;
  revokedAt?: Date;
  expiresAt: Date;
  issuedAt: Date;
}

export class RefreshTokenRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Store a refresh token
   */
  async storeRefreshToken(
    userId: string,
    jti: string,
    tokenFamily: string,
    expiresAt: Date,
  ): Promise<RefreshTokenRecord> {
    const result = await this.db.query<RefreshTokenRecord>(
      `INSERT INTO refresh_tokens (user_id, jti, token_family, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id as "userId", jti, token_family as "tokenFamily", is_revoked as "isRevoked", 
                 revoked_at as "revokedAt", expires_at as "expiresAt", issued_at as "issuedAt"`,
      [userId, jti, tokenFamily, expiresAt],
    );

    if (result.rows.length === 0) {
      throw new Error("Failed to store refresh token");
    }

    return result.rows[0];
  }

  /**
   * Check if refresh token is valid and not revoked
   */
  async isRefreshTokenValid(jti: string): Promise<boolean> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM refresh_tokens 
       WHERE jti = $1 AND is_revoked = false AND expires_at > CURRENT_TIMESTAMP`,
      [jti],
    );
    return Number(result.rows[0]?.count ?? 0) > 0;
  }

  /**
   * Revoke a refresh token
   */
  async revokeRefreshToken(jti: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP WHERE jti = $1`,
      [jti],
    );
  }

  /**
   * Revoke all tokens in a family (for token rotation)
   */
  async revokeTokenFamily(tokenFamily: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP WHERE token_family = $1`,
      [tokenFamily],
    );
  }

  /**
   * Get refresh token details
   */
  async getRefreshToken(jti: string): Promise<RefreshTokenRecord | undefined> {
    const result = await this.db.query<RefreshTokenRecord>(
      `SELECT id, user_id as "userId", jti, token_family as "tokenFamily", is_revoked as "isRevoked",
              revoked_at as "revokedAt", expires_at as "expiresAt", issued_at as "issuedAt"
       FROM refresh_tokens WHERE jti = $1`,
      [jti],
    );
    return result.rows[0];
  }

  /**
   * Get all active refresh tokens for a user
   */
  async getUserRefreshTokens(userId: string): Promise<RefreshTokenRecord[]> {
    const result = await this.db.query<RefreshTokenRecord>(
      `SELECT id, user_id as "userId", jti, token_family as "tokenFamily", is_revoked as "isRevoked",
              revoked_at as "revokedAt", expires_at as "expiresAt", issued_at as "issuedAt"
       FROM refresh_tokens
       WHERE user_id = $1 AND is_revoked = false AND expires_at > CURRENT_TIMESTAMP
       ORDER BY issued_at DESC`,
      [userId],
    );
    return result.rows;
  }

  /**
   * Cleanup expired refresh tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP`,
    );
    return result.rowCount || 0;
  }

  /**
   * Revoke all refresh tokens for a user (for logout)
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND is_revoked = false`,
      [userId],
    );
  }
}

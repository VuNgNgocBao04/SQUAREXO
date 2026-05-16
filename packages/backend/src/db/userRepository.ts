import type { User } from "../types/auth";
import type { DatabaseConnection } from "./client";

export type UserStoreErrorCode = "USER_EXISTS_EMAIL" | "USER_EXISTS_USERNAME" | "USER_NOT_FOUND";

export class UserStoreError extends Error {
  readonly code: UserStoreErrorCode;

  constructor(code: UserStoreErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export class UserRepository {
  constructor(private db: DatabaseConnection) {}

  private normalize(value: string): string {
    return value.toLowerCase();
  }

  /**
   * Create a new user in the database
   */
  async createUser(user: User): Promise<User> {
    const normalizedEmail = this.normalize(user.email);
    const normalizedUsername = this.normalize(user.username);

    try {
      const result = await this.db.query<User>(
        `INSERT INTO users (id, username, email, username_lower, email_lower, password_hash, wallet_address, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, username, email, password_hash as "passwordHash", wallet_address as "walletAddress",
                   role, created_at as "createdAt", updated_at as "updatedAt"`,
        [user.id, user.username, user.email, normalizedUsername, normalizedEmail, user.passwordHash, user.walletAddress || null, user.role || "player"],
      );

      if (result.rows.length === 0) {
        throw new Error("Failed to create user");
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("unique constraint") && error.message.includes("email")) {
          throw new UserStoreError("USER_EXISTS_EMAIL", `User with email ${user.email} already exists`);
        }
        if (error.message.includes("unique constraint") && error.message.includes("username")) {
          throw new UserStoreError("USER_EXISTS_USERNAME", `User with username ${user.username} already exists`);
        }
      }
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | undefined> {
    const result = await this.db.query<User>(
      `SELECT id, username, email, password_hash as "passwordHash", wallet_address as "walletAddress",
              role, created_at as "createdAt", updated_at as "updatedAt"
       FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0];
  }

  /**
   * Find user by email (case-insensitive)
   */
  async findByEmail(email: string): Promise<User | undefined> {
    const normalizedEmail = this.normalize(email);
    const result = await this.db.query<User>(
      `SELECT id, username, email, password_hash as "passwordHash", wallet_address as "walletAddress",
              role, created_at as "createdAt", updated_at as "updatedAt"
       FROM users WHERE email_lower = $1`,
      [normalizedEmail],
    );
    return result.rows[0];
  }

  /**
   * Find user by username (case-insensitive)
   */
  async findByUsername(username: string): Promise<User | undefined> {
    const normalizedUsername = this.normalize(username);
    const result = await this.db.query<User>(
      `SELECT id, username, email, password_hash as "passwordHash", wallet_address as "walletAddress",
              role, created_at as "createdAt", updated_at as "updatedAt"
       FROM users WHERE username_lower = $1`,
      [normalizedUsername],
    );
    return result.rows[0];
  }

  /**
   * Update user
   */
  async updateUser(user: User): Promise<User> {
    try {
      const result = await this.db.query<User>(
        `UPDATE users SET
           username = $1, email = $2, username_lower = $3, email_lower = $4,
           password_hash = $5, wallet_address = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING id, username, email, password_hash as "passwordHash", wallet_address as "walletAddress",
                   role, created_at as "createdAt", updated_at as "updatedAt"`,
        [
          user.username,
          user.email,
          this.normalize(user.username),
          this.normalize(user.email),
          user.passwordHash,
          user.walletAddress || null,
          user.id,
        ],
      );

      if (result.rows.length === 0) {
        throw new UserStoreError("USER_NOT_FOUND", `User with id ${user.id} not found`);
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof Error && error.message.includes("unique constraint")) {
        if (error.message.includes("email")) {
          throw new UserStoreError("USER_EXISTS_EMAIL", `User with email ${user.email} already exists`);
        }
        if (error.message.includes("username")) {
          throw new UserStoreError("USER_EXISTS_USERNAME", `User with username ${user.username} already exists`);
        }
      }
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    await this.db.query(`DELETE FROM users WHERE id = $1`, [id]);
  }

  /**
   * Get all users (for admin purposes)
   */
  async getAllUsers(): Promise<User[]> {
    const result = await this.db.query<User>(
      `SELECT id, username, email, password_hash as "passwordHash", wallet_address as "walletAddress",
              role, created_at as "createdAt", updated_at as "updatedAt"
       FROM users ORDER BY created_at DESC`,
    );
    return result.rows;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [userId],
    );
  }
}

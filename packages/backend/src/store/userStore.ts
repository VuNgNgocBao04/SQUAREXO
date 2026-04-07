import type { User } from "../types/auth";

export type UserStoreErrorCode = "USER_EXISTS_EMAIL" | "USER_EXISTS_USERNAME";

export class UserStoreError extends Error {
  readonly code: UserStoreErrorCode;

  constructor(code: UserStoreErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * In-memory user store
 * In production, this should be replaced with a database (MongoDB, PostgreSQL, etc.)
 */
export class UserStore {
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, string> = new Map();
  private usersByUsername: Map<string, string> = new Map();

  private normalize(value: string): string {
    return value.toLowerCase();
  }

  /**
   * Create a new user
   */
  createUser(user: User): User {
    const normalizedEmail = this.normalize(user.email);
    const normalizedUsername = this.normalize(user.username);

    if (this.usersByEmail.has(normalizedEmail)) {
      throw new UserStoreError("USER_EXISTS_EMAIL", `User with email ${user.email} already exists`);
    }
    if (this.usersByUsername.has(normalizedUsername)) {
      throw new UserStoreError("USER_EXISTS_USERNAME", `User with username ${user.username} already exists`);
    }

    this.users.set(user.id, user);
    this.usersByEmail.set(normalizedEmail, user.id);
    this.usersByUsername.set(normalizedUsername, user.id);
    return user;
  }

  /**
   * Find user by ID
   */
  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  /**
   * Find user by email
   */
  findByEmail(email: string): User | undefined {
    const userId = this.usersByEmail.get(this.normalize(email));
    if (!userId) return undefined;
    return this.users.get(userId);
  }

  /**
   * Find user by username
   */
  findByUsername(username: string): User | undefined {
    const userId = this.usersByUsername.get(this.normalize(username));
    if (!userId) return undefined;
    return this.users.get(userId);
  }

  /**
   * Update user
   */
  updateUser(user: User): User {
    if (!this.users.has(user.id)) {
      throw new Error(`User with id ${user.id} not found`);
    }

    const existing = this.users.get(user.id);
    if (!existing) {
      throw new Error(`User with id ${user.id} not found`);
    }

    const existingEmail = this.normalize(existing.email);
    const existingUsername = this.normalize(existing.username);
    const nextEmail = this.normalize(user.email);
    const nextUsername = this.normalize(user.username);

    if (existingEmail !== nextEmail) {
      const matchingUserId = this.usersByEmail.get(nextEmail);
      if (matchingUserId && matchingUserId !== user.id) {
        throw new UserStoreError("USER_EXISTS_EMAIL", `User with email ${user.email} already exists`);
      }
      this.usersByEmail.delete(existingEmail);
      this.usersByEmail.set(nextEmail, user.id);
    }

    if (existingUsername !== nextUsername) {
      const matchingUserId = this.usersByUsername.get(nextUsername);
      if (matchingUserId && matchingUserId !== user.id) {
        throw new UserStoreError("USER_EXISTS_USERNAME", `User with username ${user.username} already exists`);
      }
      this.usersByUsername.delete(existingUsername);
      this.usersByUsername.set(nextUsername, user.id);
    }

    this.users.set(user.id, user);
    return user;
  }

  /**
   * Clear all users (for testing)
   */
  clear(): void {
    this.users.clear();
    this.usersByEmail.clear();
    this.usersByUsername.clear();
  }
}

// Singleton instance
export const userStore = new UserStore();

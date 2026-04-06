import type { User } from "../types/auth";

/**
 * In-memory user store
 * In production, this should be replaced with a database (MongoDB, PostgreSQL, etc.)
 */
export class UserStore {
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, string> = new Map();

  /**
   * Create a new user
   */
  createUser(user: User): User {
    if (this.usersByEmail.has(user.email)) {
      throw new Error(`User with email ${user.email} already exists`);
    }

    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user.id);
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
    const userId = this.usersByEmail.get(email);
    if (!userId) return undefined;
    return this.users.get(userId);
  }

  /**
   * Find user by username
   */
  findByUsername(username: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  /**
   * Update user
   */
  updateUser(user: User): User {
    if (!this.users.has(user.id)) {
      throw new Error(`User with id ${user.id} not found`);
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
  }
}

// Singleton instance
export const userStore = new UserStore();

import { describe, it, expect, beforeEach } from "vitest";
import { UserStore } from "../../src/store/userStore";
import type { User } from "../../src/types/auth";

describe("UserStore", () => {
  let store: UserStore;

  const createTestUser = (overrides?: Partial<User>): User => ({
    id: "user123",
    username: "testuser",
    email: "test@example.com",
    passwordHash: "hashedpassword",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    store = new UserStore();
  });

  describe("createUser", () => {
    it("should create a new user", () => {
      const user = createTestUser();
      const created = store.createUser(user);

      expect(created).toEqual(user);
    });

    it("should throw error if user with same email exists", () => {
      const user1 = createTestUser({
        id: "user1",
        email: "test@example.com",
      });
      const user2 = createTestUser({
        id: "user2",
        email: "test@example.com",
      });

      store.createUser(user1);

      expect(() => {
        store.createUser(user2);
      }).toThrow("already exists");
    });

    it("should throw error if user with same username exists", () => {
      const user1 = createTestUser({
        id: "user1",
        username: "testuser",
        email: "test1@example.com",
      });
      const user2 = createTestUser({
        id: "user2",
        username: "testuser",
        email: "test2@example.com",
      });

      store.createUser(user1);

      expect(() => {
        store.createUser(user2);
      }).toThrow("already exists");
    });  });

  describe("findById", () => {
    it("should find user by id", () => {
      const user = createTestUser();
      store.createUser(user);

      const found = store.findById("user123");

      expect(found).toEqual(user);
    });

    it("should return undefined if user not found", () => {
      const found = store.findById("nonexistent");
      expect(found).toBeUndefined();
    });
  });

  describe("findByEmail", () => {
    it("should find user by email", () => {
      const user = createTestUser();
      store.createUser(user);

      const found = store.findByEmail("test@example.com");

      expect(found).toEqual(user);
    });

    it("should return undefined if user not found", () => {
      const found = store.findByEmail("nonexistent@example.com");
      expect(found).toBeUndefined();
    });

    it("should be case-sensitive for email", () => {
      const user = createTestUser();
      store.createUser(user);

      const found = store.findByEmail("TEST@EXAMPLE.COM");
      expect(found).toBeUndefined();
    });
  });

  describe("findByUsername", () => {
    it("should find user by username", () => {
      const user = createTestUser();
      store.createUser(user);

      const found = store.findByUsername("testuser");

      expect(found).toEqual(user);
    });

    it("should return undefined if user not found", () => {
      const found = store.findByUsername("nonexistent");
      expect(found).toBeUndefined();
    });
  });

  describe("updateUser", () => {
    it("should update an existing user", () => {
      const user = createTestUser();
      store.createUser(user);

      const updated = createTestUser({
        id: "user123",
        username: "updateduser",
      });
      store.updateUser(updated);

      const found = store.findById("user123");
      expect(found?.username).toBe("updateduser");
    });

    it("should throw error if user not found", () => {
      const user = createTestUser();

      expect(() => {
        store.updateUser(user);
      }).toThrow("not found");
    });
  });

  describe("clear", () => {
    it("should clear all users", () => {
      const user1 = createTestUser({
        id: "user1",
        username: "user1",
        email: "user1@example.com",
      });
      const user2 = createTestUser({
        id: "user2",
        username: "user2",
        email: "user2@example.com",
      });

      store.createUser(user1);
      store.createUser(user2);

      expect(store.findById("user1")).toBeDefined();
      expect(store.findById("user2")).toBeDefined();

      store.clear();

      expect(store.findById("user1")).toBeUndefined();
      expect(store.findById("user2")).toBeUndefined();
    });
  });
});

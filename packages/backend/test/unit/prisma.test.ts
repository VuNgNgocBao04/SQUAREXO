import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  delete global.__squarexoPrisma;
  vi.resetModules();
  vi.unmock("@prisma/client");
});

describe("prisma helpers", () => {
  it("returns null and no-ops when DATABASE_URL is missing", async () => {
    process.env = { ...originalEnv, DATABASE_URL: "" };

    const prismaModule = await import("../../src/db/prisma");

    expect(prismaModule.isDatabaseConfigured()).toBe(false);
    expect(prismaModule.getPrismaClient()).toBeNull();
    await expect(prismaModule.initDatabaseConnection()).resolves.toBeUndefined();
    await expect(prismaModule.closeDatabaseConnection()).resolves.toBeUndefined();
  });

  it("creates, caches and disconnects Prisma client when DATABASE_URL exists", async () => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgresql://squarexo:squarexo@localhost:55432/squarexo?schema=public",
      NODE_ENV: "test",
    };

    const connect = vi.fn().mockResolvedValue(undefined);
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const prismaInstance = {
      $connect: connect,
      $disconnect: disconnect,
    };

    vi.doMock("@prisma/client", () => ({
      PrismaClient: vi.fn(() => prismaInstance),
    }));

    const prismaModule = await import("../../src/db/prisma");

    expect(prismaModule.isDatabaseConfigured()).toBe(true);

    const first = prismaModule.getPrismaClient();
    const second = prismaModule.getPrismaClient();

    expect(first).toBe(prismaInstance);
    expect(second).toBe(prismaInstance);
    expect(global.__squarexoPrisma).toBe(prismaInstance);

    await prismaModule.initDatabaseConnection();
    expect(connect).toHaveBeenCalledTimes(1);

    await prismaModule.closeDatabaseConnection();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(global.__squarexoPrisma).toBeUndefined();
    expect(prismaModule.getPrismaClient()).toBe(prismaInstance);
  });
});

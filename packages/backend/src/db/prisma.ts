import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __squarexoPrisma: PrismaClient | undefined;
}

let prisma: PrismaClient | null = null;

export function isDatabaseConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

export function getPrismaClient(): PrismaClient | null {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (prisma) {
    return prisma;
  }

  if (global.__squarexoPrisma) {
    prisma = global.__squarexoPrisma;
    return prisma;
  }

  prisma = new PrismaClient();

  if (process.env.NODE_ENV !== "production") {
    global.__squarexoPrisma = prisma;
  }

  return prisma;
}

export async function initDatabaseConnection(): Promise<void> {
  const client = getPrismaClient();
  if (!client) {
    return;
  }

  await client.$connect();
}

export async function closeDatabaseConnection(): Promise<void> {
  if (!prisma) {
    return;
  }

  await prisma.$disconnect();

  if (process.env.NODE_ENV !== "production") {
    global.__squarexoPrisma = undefined;
  }

  prisma = null;
}

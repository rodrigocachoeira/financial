import { createPrismaClient, type PrismaClient } from "./prisma";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function connect(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return createPrismaClient(url);
}

/** Single client per process; reused across hot reloads in development. */
export const db = globalForPrisma.prisma ?? connect();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

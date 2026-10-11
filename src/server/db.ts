import { createPrismaClient, type PrismaClient } from "./prisma";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Single client per process, created on first use so that builds without a
 * database (CI, preview deployments) still succeed.
 */
export function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    // The driver does not reject a malformed value; it tries to connect to a host named "base".
    if (!/^postgres(ql)?:\/\/\S+$/.test(url)) {
      throw new Error("DATABASE_URL is not a connection string: it must start with postgresql:// and have no quotes or spaces");
    }
    globalForPrisma.prisma = createPrismaClient(url);
  }
  return globalForPrisma.prisma;
}

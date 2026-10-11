import { readFileSync } from "node:fs";
import { createPrismaClient } from "../prisma";

/** Client for `*.db.test.ts` files. Points at the test database only. */
export const testDb = createPrismaClient(process.env.TEST_DATABASE_URL!);

export function resetTestDb() {
  return testDb.$executeRawUnsafe(
    'TRUNCATE "transactions", "imports", "merchants", "categories", "accounts" CASCADE',
  );
}

export const fixtureBytes = (name: string) => new Uint8Array(readFileSync(`fixtures/nubank/${name}`));

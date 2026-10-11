import { readFileSync } from "node:fs";
import { createPrismaClient } from "../prisma";

/** Client for `*.db.test.ts` files. Points at the test database only. */
export const testDb = createPrismaClient(process.env.TEST_DATABASE_URL!);

/** Clears imported data. Categories and rules are seeded by a migration and stay. */
export function resetTestDb() {
  return testDb.$executeRawUnsafe('TRUNCATE "transactions", "imports", "merchants", "accounts" CASCADE');
}

export const categoryId = async (name: string) =>
  (await testDb.category.findUniqueOrThrow({ where: { name } })).id;

export const fixtureBytes = (name: string) => new Uint8Array(readFileSync(`fixtures/nubank/${name}`));

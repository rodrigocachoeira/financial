import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { parseNubankOfx, type ParsedStatement } from "@/lib/ofx";
import { monthYield } from "@/lib/reports/yield";
import { importFile } from "../imports/import-file";
import { importStatement } from "../imports/import-statement";
import { fixtureBytes, resetTestDb, testDb as db } from "../testing/test-db";
import { loadYieldSources } from "./load-yield-sources";

const account = parseNubankOfx(readFileSync("fixtures/nubank/account.ofx", "utf8"));

const period = (periodStart: string, periodEnd: string, netYieldCents: number | null): ParsedStatement => ({
  ...account,
  periodStart,
  periodEnd,
  netYieldCents,
  transactions: [],
});

beforeEach(async () => {
  await resetTestDb();
});

afterAll(() => db.$disconnect());

describe("account yield", () => {
  it("is stored with the import and loaded for the reports", async () => {
    await importFile(db, { name: "account.ofx", bytes: fixtureBytes("account.ofx") });

    expect((await db.import.findFirstOrThrow()).netYieldCents).toBe(1234);
    const sources = await loadYieldSources(db);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ periodStart: "2026-01-01", periodEnd: "2026-01-31", netYieldCents: 1234 });
    expect(monthYield(sources, "2026-01")).toEqual({ month: "2026-01", cents: 1234, partialUntil: null });
  });

  it("does not come from card statements", async () => {
    await importFile(db, { name: "card.ofx", bytes: fixtureBytes("credit-card.ofx") });

    expect((await db.import.findFirstOrThrow()).netYieldCents).toBeNull();
    expect(await loadYieldSources(db)).toEqual([]);
  });

  it("is filled in when a file imported before this was read is sent again", async () => {
    const before = await importStatement(db, {
      statement: { ...account, netYieldCents: null },
      fileName: "account.ofx",
      fileHash: "same",
    });
    expect(await loadYieldSources(db)).toEqual([]);

    const again = await importStatement(db, { statement: account, fileName: "account.ofx", fileHash: "same" });

    expect(again).toMatchObject({ importId: before.importId, alreadyImported: true, newTransactionCount: 0 });
    expect((await db.import.findUniqueOrThrow({ where: { id: before.importId } })).netYieldCents).toBe(1234);
    expect(await db.import.count()).toBe(1);
  });

  it("uses the fuller statement of a month and never adds statements up", async () => {
    await importStatement(db, { statement: period("2026-10-01", "2026-10-10", 1200), fileName: "a.ofx", fileHash: "a" });
    expect(monthYield(await loadYieldSources(db), "2026-10")).toEqual({
      month: "2026-10",
      cents: 1200,
      partialUntil: "2026-10-10",
    });

    await importStatement(db, { statement: period("2026-10-01", "2026-10-31", 3800), fileName: "b.ofx", fileHash: "b" });

    expect(monthYield(await loadYieldSources(db), "2026-10")).toEqual({
      month: "2026-10",
      cents: 3800,
      partialUntil: null,
    });
  });
});

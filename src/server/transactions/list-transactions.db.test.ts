import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importFile } from "../imports/import-file";
import { fixtureBytes, resetTestDb, testDb as db } from "../testing/test-db";
import { listMonths, listTransactions } from "./list-transactions";

beforeAll(async () => {
  await resetTestDb();
  await importFile(db, { name: "account.ofx", bytes: fixtureBytes("account.ofx") });
  await importFile(db, { name: "card.ofx", bytes: fixtureBytes("credit-card.ofx") });
});

afterAll(async () => {
  await resetTestDb();
  await db.$disconnect();
});

describe("listTransactions", () => {
  it("lists the month across accounts, newest first", async () => {
    const { rows } = await listTransactions(db, { month: "2026-01" });

    expect(rows).toHaveLength(10);
    const dates = rows.map((row) => row.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(dates[0]).toBe("2026-01-25");
    expect(dates.at(-1)).toBe("2026-01-05");
  });

  it("returns the fields the list shows", async () => {
    const { rows } = await listTransactions(db, { month: "2026-01" });

    expect(rows.find((row) => row.date === "2026-01-11")).toMatchObject({
      description: "MP *LOJAEXEMPLO - Parcela 2/10",
      merchant: "MP *LOJAEXEMPLO",
      source: "CREDIT_CARD",
      kind: "CARD_PURCHASE",
      amountCents: -8990,
      installment: { number: 2, total: 10 },
      internalTransfer: false,
    });
    expect(rows.find((row) => row.kind === "BILL_PAYMENT")).toMatchObject({
      merchant: null,
      source: "ACCOUNT",
      installment: null,
      internalTransfer: true,
    });
  });

  it("filters by source", async () => {
    const account = await listTransactions(db, { month: "2026-01", source: "ACCOUNT" });
    const card = await listTransactions(db, { month: "2026-01", source: "CREDIT_CARD" });

    expect(account.rows).toHaveLength(5);
    expect(account.rows.every((row) => row.source === "ACCOUNT")).toBe(true);
    expect(card.rows).toHaveLength(5);
    expect(card.rows.every((row) => row.source === "CREDIT_CARD")).toBe(true);
  });

  it("leaves internal transfers out of the totals", async () => {
    const { totals } = await listTransactions(db, { month: "2026-01" });
    expect(totals).toEqual({ inCents: 500000, outCents: -77500, netCents: 422500 });

    const card = await listTransactions(db, { month: "2026-01", source: "CREDIT_CARD" });
    expect(card.totals).toEqual({ inCents: 0, outCents: -49710, netCents: -49710 });
  });

  it("returns nothing for a month without data or an invalid month", async () => {
    const empty = { rows: [], totals: { inCents: 0, outCents: 0, netCents: 0 } };
    expect(await listTransactions(db, { month: "2025-06" })).toEqual(empty);
    expect(await listTransactions(db, { month: "nope" })).toEqual(empty);
  });

  it("uses the month boundaries exactly", async () => {
    const account = await db.account.findFirstOrThrow({ where: { source: "ACCOUNT" } });
    const anImport = await db.import.findFirstOrThrow({ where: { accountId: account.id } });
    const base = { accountId: account.id, importId: anImport.id, amountCents: -100, description: "x", kind: "OTHER" } as const;
    await db.transaction.createMany({
      data: [
        { ...base, externalId: "last-day", date: new Date("2026-02-28T00:00:00.000Z") },
        { ...base, externalId: "next-month", date: new Date("2026-03-01T00:00:00.000Z") },
      ],
    });

    const { rows } = await listTransactions(db, { month: "2026-02" });
    expect(rows.map((row) => row.date)).toEqual(["2026-02-28"]);
  });
});

describe("listMonths", () => {
  it("lists months with data once each, newest first", async () => {
    expect(await listMonths(db)).toEqual(["2026-03", "2026-02", "2026-01"]);
  });
});

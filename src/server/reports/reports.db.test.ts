import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  futureInstallments,
  monthSummary,
  recurringSpending,
  spendingByCategory,
  topMerchants,
} from "@/lib/reports/reports";
import { setTransactionCategory } from "../categorization/set-transaction-category";
import { importFile } from "../imports/import-file";
import { categoryId, fixtureBytes, resetTestDb, testDb as db } from "../testing/test-db";
import { listTransactions } from "../transactions/list-transactions";
import { loadReportRows } from "./load-report-rows";

beforeAll(async () => {
  await resetTestDb();
  for (const name of ["account.ofx", "credit-card.ofx", "credit-card-related-entries.ofx"]) {
    await importFile(db, { name, bytes: fixtureBytes(name) });
  }
});

afterAll(async () => {
  await resetTestDb();
  await db.$disconnect();
});

const byCategory = async (month: string) =>
  spendingByCategory(await loadReportRows(db, month), month).map((entry) => [
    entry.category?.name ?? null,
    entry.spentCents,
  ]);

describe("reports over the fixtures", () => {
  it("summarizes January", async () => {
    const rows = await loadReportRows(db, "2026-01");

    expect(monthSummary(rows, "2026-01")).toEqual({ spentCents: 77500, incomeCents: 500000, netCents: 422500 });
    expect(await byCategory("2026-01")).toEqual([
      ["Alimentação", 10320],
      ["Assinaturas", 3990],
      [null, 63190],
    ]);
  });

  it("summarizes February, where IOF and its return cancel out", async () => {
    const rows = await loadReportRows(db, "2026-02");

    expect(monthSummary(rows, "2026-02").spentCents).toBe(86417);
    expect((await byCategory("2026-02")).map(([name]) => name)).not.toContain("Serviços e taxas");
    expect(topMerchants(rows, "2026-02", 10).find((entry) => entry.merchant === "MP *VIAGEMEXEMPLO")?.spentCents).toBe(
      3427,
    );
  });

  it("does not load transactions after the reference month", async () => {
    const rows = await loadReportRows(db, "2026-01");
    expect(rows.every((row) => row.date < "2026-02-01")).toBe(true);
    expect(rows).toHaveLength(8);
  });

  it("projects the installments still open after February", async () => {
    const result = futureInstallments(await loadReportRows(db, "2026-02"), "2026-02", 12);

    expect(result.purchases).toEqual([
      { merchant: "MP *LOJAEXEMPLO", currentNumber: 3, total: 10, remaining: 7, monthlyCents: 8990, endMonth: "2026-09" },
    ]);
    expect(result.byMonth.filter((entry) => entry.cents > 0).map((entry) => entry.month)).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it("projects from January as it stood then", async () => {
    const result = futureInstallments(await loadReportRows(db, "2026-01"), "2026-01", 12);

    expect(result.purchases.map((purchase) => [purchase.merchant, purchase.currentNumber, purchase.remaining])).toEqual([
      ["MP *LOJAEXEMPLO", 2, 8],
      ["ELETRONICOSEXEMPLO*1PRODUTO", 10, 2],
    ]);
  });

  it("finds nothing recurring with two months of history", async () => {
    expect(recurringSpending(await loadReportRows(db, "2026-02"), "2026-02")).toEqual([]);
  });

  it("returns nothing for an invalid month", async () => {
    expect(await loadReportRows(db, "nope")).toEqual([]);
  });
});

describe("a category that does not count as spending", () => {
  it("takes its transactions out of the reports and of the list totals", async () => {
    const own = await categoryId("Transferências próprias");
    const pix = await db.transaction.findFirstOrThrow({ where: { merchant: { name: "FULANO DE TAL" } } });
    await setTransactionCategory(db, pix.id, own);

    const rows = await loadReportRows(db, "2026-01");
    expect(monthSummary(rows, "2026-01").spentCents).toBe(57500);
    expect((await byCategory("2026-01")).map(([name]) => name)).not.toContain("Transferências próprias");
    expect(topMerchants(rows, "2026-01", 10).map((entry) => entry.merchant)).not.toContain("FULANO DE TAL");

    const { totals } = await listTransactions(db, { month: "2026-01" });
    expect(totals).toEqual({ inCents: 500000, outCents: -57500, netCents: 442500 });
  });
});

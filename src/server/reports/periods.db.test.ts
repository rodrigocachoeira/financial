import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { transactionsCsv } from "@/lib/export/transactions-csv";
import { parseNubankOfx } from "@/lib/ofx";
import { balanceEvolution } from "@/lib/reports/balance";
import { categoryBreakdown, spendingVsAverage, summarize } from "@/lib/reports/reports";
import { importFile } from "../imports/import-file";
import { importStatement } from "../imports/import-statement";
import { fixtureBytes, resetTestDb, testDb as db } from "../testing/test-db";
import { listTransactions } from "../transactions/list-transactions";
import { loadBalanceSources } from "./load-balance-sources";
import { loadReportRows, loadYearRows } from "./load-report-rows";

const account = parseNubankOfx(readFileSync("fixtures/nubank/account.ofx", "utf8"));

beforeAll(async () => {
  await resetTestDb();
  for (const name of ["account.ofx", "credit-card.ofx", "credit-card-related-entries.ofx"]) {
    await importFile(db, { name, bytes: fixtureBytes(name) });
  }
  // A statement of the previous year and a partial one of March, for year boundaries and balances.
  await importStatement(db, {
    statement: {
      ...account,
      periodStart: "2025-12-01",
      periodEnd: "2025-12-31",
      ledgerBalanceCents: 100000,
      ledgerBalanceDate: "2025-12-31",
      transactions: [{ ...account.transactions[3], externalId: "december", date: "2025-12-31" }],
    },
    fileName: "december.ofx",
    fileHash: "december",
  });
  await importStatement(db, {
    statement: {
      ...account,
      periodStart: "2026-03-01",
      periodEnd: "2026-03-10",
      ledgerBalanceCents: 250000,
      ledgerBalanceDate: "2026-03-10",
      transactions: [],
    },
    fileName: "march.ofx",
    fileHash: "march",
  });
});

afterAll(async () => {
  await resetTestDb();
  await db.$disconnect();
});

describe("yearly report", () => {
  it("loads exactly the transactions of the year", async () => {
    const rows = await loadYearRows(db, "2026");

    expect(rows.every((row) => row.date.startsWith("2026-"))).toBe(true);
    expect(summarize(rows)).toEqual({ spentCents: 77500 + 86417, incomeCents: 500000, netCents: 500000 - 163917 });
    expect((await loadYearRows(db, "2025")).map((row) => row.date)).toEqual(["2025-12-31"]);
  });

  it("breaks the year down by category", async () => {
    const breakdown = categoryBreakdown(await loadYearRows(db, "2026"));
    const byName = new Map(breakdown.map((entry) => [entry.category?.name ?? null, entry.spentCents]));

    expect(byName.get("Alimentação")).toBe(10320);
    expect(byName.get("Assinaturas")).toBe(3990);
    expect(byName.has("Serviços e taxas")).toBe(false);
  });

  it("returns nothing for something that is not a year", async () => {
    expect(await loadYearRows(db, "2026-01")).toEqual([]);
    expect(await loadYearRows(db, "abcd")).toEqual([]);
  });
});

describe("comparison with earlier months", () => {
  it("uses the months that have data", async () => {
    const result = spendingVsAverage(await loadReportRows(db, "2026-02"), "2026-02");
    const uncategorized = result.find((entry) => entry.category === null);

    // December and January have spending; November has none and is not averaged in.
    expect(uncategorized?.averageCents).toBe(Math.round((3200 + 63190) / 2));
    expect(uncategorized?.unusual).toBe(true);
  });
});

describe("account balance", () => {
  it("comes from the account statements only, by closing day", async () => {
    const sources = await loadBalanceSources(db);

    expect(sources.map((source) => [source.date, source.cents])).toEqual([
      ["2025-12-31", 100000],
      ["2026-01-31", 347173],
      ["2026-03-10", 250000],
    ]);
    expect(balanceEvolution(sources, "2026-03", 4)).toEqual([
      { month: "2025-12", cents: 100000, date: "2025-12-31" },
      { month: "2026-01", cents: 347173, date: "2026-01-31" },
      { month: "2026-02", cents: null, date: null },
      { month: "2026-03", cents: 250000, date: "2026-03-10" },
    ]);
  });
});

describe("export", () => {
  it("lists a whole year, newest first", async () => {
    const { rows } = await listTransactions(db, { month: "2026" });

    expect(rows).toHaveLength(19);
    expect(rows[0].date >= rows.at(-1)!.date).toBe(true);
    expect(rows.every((row) => row.date.startsWith("2026-"))).toBe(true);
  });

  it("produces a CSV line per transaction, bill payments included", async () => {
    const { rows } = await listTransactions(db, { month: "2026-01", source: "ACCOUNT" });
    const lines = transactionsCsv(rows).trimEnd().split("\r\n");

    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain("Data;Descrição;Estabelecimento;Categoria;Origem;Tipo;Parcela;Valor");
    expect(lines).toContain("10/01/2026;Pagamento de fatura;;;Conta;Pagamento de fatura;;-1250,37");
    expect(lines.some((line) => line.includes("PADARIA MODELO LTDA;Alimentação;Conta;Pix enviado;;-45,9"))).toBe(true);
  });
});

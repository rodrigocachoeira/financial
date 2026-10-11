import { describe, expect, it } from "vitest";
import type { TransactionKind } from "../ofx";
import { addMonthsToDate, monthsOfYear } from "./months";
import {
  categoryBreakdown,
  inYear,
  merchantRanking,
  recurringSpending,
  spendingVsAverage,
  summarize,
  type ReportCategory,
  type ReportRow,
} from "./reports";

const category = (name: string): ReportCategory => ({ id: name.toLowerCase(), name, color: "#000000", countsAsSpending: true });
const FOOD = category("Food");
const PETS = category("Pets");
const FUN = category("Fun");

let nextId = 0;
function row(date: string, amountCents: number, options: Partial<ReportRow> = {}): ReportRow {
  nextId += 1;
  const kind: TransactionKind = amountCents < 0 ? "CARD_PURCHASE" : "PIX_RECEIVED";
  return { date, amountCents, kind, merchant: "SHOP", category: null, purchaseId: `p-${nextId}`, installment: null, ...options };
}

describe("date helpers", () => {
  it("lists the twelve months of a year", () => {
    const months = monthsOfYear("2026");
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2026-01");
    expect(months[11]).toBe("2026-12");
  });

  it("moves a date by months, clamping to the last day", () => {
    expect(addMonthsToDate("2026-03-10", 1)).toBe("2026-04-10");
    expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToDate("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsToDate("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonthsToDate("2026-03-31", -1)).toBe("2026-02-28");
  });
});

describe("reports over a year", () => {
  const rows = [
    row("2025-12-31", -99999, { category: FOOD }),
    row("2026-01-10", -10000, { category: FOOD, merchant: "A" }),
    row("2026-06-10", -20000, { category: PETS, merchant: "B" }),
    row("2026-06-11", 5000, { category: PETS, merchant: "B", kind: "CARD_REFUND" }),
    row("2026-12-31", -30000, { category: FOOD, merchant: "A" }),
    row("2026-03-05", 400000),
    row("2027-01-01", -88888, { category: FOOD }),
  ];
  const year = inYear(rows, "2026");

  it("keeps only the rows of the year", () => {
    expect(year.map((entry) => entry.date)).toEqual(["2026-01-10", "2026-06-10", "2026-06-11", "2026-12-31", "2026-03-05"]);
  });

  it("summarizes, breaks down by category and ranks merchants", () => {
    expect(summarize(year)).toEqual({ spentCents: 55000, incomeCents: 400000, netCents: 345000 });
    expect(categoryBreakdown(year).map((entry) => [entry.category?.name, entry.spentCents])).toEqual([
      ["Food", 40000],
      ["Pets", 15000],
    ]);
    expect(merchantRanking(year, 10).map((entry) => [entry.merchant, entry.spentCents, entry.transactionCount])).toEqual([
      ["A", 40000, 2],
      ["B", 15000, 1],
    ]);
  });
});

describe("spendingVsAverage", () => {
  const rows = [
    // Earlier months: December has no data at all.
    row("2026-01-05", -10000, { category: FOOD }),
    row("2026-01-06", -40000, { category: PETS }),
    row("2026-02-05", -14000, { category: FOOD }),
    row("2026-02-06", -40000, { category: PETS }),
    // Reference month.
    row("2026-03-05", -30000, { category: FOOD }),
    row("2026-03-06", -42000, { category: PETS }),
    row("2026-03-07", -9000, { category: FUN }),
    row("2026-03-08", -2000),
  ];

  it("compares with the average of the earlier months that have data", () => {
    const result = spendingVsAverage(rows, "2026-03");
    const byName = new Map(result.map((entry) => [entry.category?.name ?? null, entry]));

    expect(byName.get("Food")).toMatchObject({ spentCents: 30000, averageCents: 12000, deviation: 1.5, unusual: true });
    expect(byName.get("Pets")).toMatchObject({ spentCents: 42000, averageCents: 40000, unusual: false });
    expect(byName.get("Pets")!.deviation).toBeCloseTo(0.05);
  });

  it("does not call a small or new expense unusual by percentage alone", () => {
    const result = spendingVsAverage(rows, "2026-03");
    const byName = new Map(result.map((entry) => [entry.category?.name ?? null, entry]));

    // Never seen before: there is an average (zero), but no ratio; R$ 90 is above the R$ 50 threshold.
    expect(byName.get("Fun")).toMatchObject({ averageCents: 0, deviation: null, unusual: true });
    // R$ 20 without a category: too small to flag.
    expect(byName.get(null)).toMatchObject({ averageCents: 0, deviation: null, unusual: false });
  });

  it("keeps the order and the shares of the month's breakdown", () => {
    const result = spendingVsAverage(rows, "2026-03");
    expect(result.map((entry) => entry.category?.name ?? null)).toEqual(["Pets", "Food", "Fun", null]);
    expect(result[0].share).toBeCloseTo(42000 / 83000);
  });

  it("has nothing to compare with in the first month of data", () => {
    const result = spendingVsAverage(rows, "2026-01");
    expect(result.every((entry) => entry.averageCents === null && entry.deviation === null && !entry.unusual)).toBe(true);
  });

  it("looks back only the months asked for", () => {
    const one = spendingVsAverage(rows, "2026-03", 1).find((entry) => entry.category?.name === "Food");
    expect(one?.averageCents).toBe(14000);
  });
});

describe("recurring charges in detail", () => {
  const charge = (date: string, cents: number) => row(date, cents, { merchant: "STREAMING" });

  it("reports the last charge, the previous one and when the next is expected", () => {
    const rows = [charge("2026-01-14", -3990), charge("2026-02-14", -3990), charge("2026-03-15", -4490)];
    const [entry] = recurringSpending(rows, "2026-03");

    expect(entry).toMatchObject({
      lastCents: 4490,
      previousCents: 3990,
      lastDate: "2026-03-15",
      nextDate: "2026-04-15",
      months: 3,
    });
    expect(entry.priceChange).toBeCloseTo(500 / 3990);
  });

  it("dates the last charge in the previous month when the reference month has none yet", () => {
    const rows = [charge("2026-01-14", -3990), charge("2026-02-14", -3990), charge("2026-03-14", -3990)];
    const [entry] = recurringSpending(rows, "2026-04");

    expect(entry).toMatchObject({ lastDate: "2026-03-14", nextDate: "2026-04-14", priceChange: 0 });
  });

  it("uses the latest charge of a month charged more than once", () => {
    const rows = [
      charge("2026-01-14", -2000),
      charge("2026-02-14", -2000),
      charge("2026-03-03", -1000),
      charge("2026-03-20", -1000),
    ];
    expect(recurringSpending(rows, "2026-03")[0]).toMatchObject({ lastDate: "2026-03-20", lastCents: 2000 });
  });
});

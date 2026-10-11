import { describe, expect, it } from "vitest";
import type { TransactionKind } from "../ofx";
import type { ReportCategory, ReportRow } from "../reports/reports";
import { budgetFor, budgetReport, suggestLimit, type BudgetEntry } from "./budget";

const category = (name: string, countsAsSpending = true): ReportCategory => ({
  id: name.toLowerCase(),
  name,
  color: "#000000",
  countsAsSpending,
});

const FOOD = category("Food");
const PETS = category("Pets");
const FUN = category("Fun");
const TRAVEL = category("Travel");
const OWN = category("Own", false);
const CATEGORIES = [FOOD, PETS, FUN, TRAVEL, OWN];

let nextId = 0;
function row(date: string, amountCents: number, options: Partial<ReportRow> = {}): ReportRow {
  nextId += 1;
  const kind: TransactionKind = amountCents < 0 ? "CARD_PURCHASE" : "PIX_RECEIVED";
  return { date, amountCents, kind, merchant: "SHOP", category: null, purchaseId: `p-${nextId}`, installment: null, ...options };
}

const limit = (target: ReportCategory, startMonth: string, amountCents: number | null): BudgetEntry => ({
  categoryId: target.id,
  startMonth,
  amountCents,
});

describe("budgetFor", () => {
  const entries = [limit(FOOD, "2026-03", 80000), limit(FOOD, "2026-06", 100000), limit(FOOD, "2026-09", null), limit(PETS, "2026-01", 30000)];

  it("is the limit of the latest validity not after the month", () => {
    expect(budgetFor(entries, FOOD.id, "2026-03")).toBe(80000);
    expect(budgetFor(entries, FOOD.id, "2026-05")).toBe(80000);
    expect(budgetFor(entries, FOOD.id, "2026-06")).toBe(100000);
    expect(budgetFor(entries, FOOD.id, "2026-08")).toBe(100000);
  });

  it("is null before the first validity and after a removal", () => {
    expect(budgetFor(entries, FOOD.id, "2026-02")).toBeNull();
    expect(budgetFor(entries, FOOD.id, "2026-09")).toBeNull();
    expect(budgetFor(entries, FOOD.id, "2027-01")).toBeNull();
    expect(budgetFor(entries, FUN.id, "2026-06")).toBeNull();
  });

  it("does not depend on the order of the entries", () => {
    expect(budgetFor([...entries].reverse(), FOOD.id, "2026-07")).toBe(100000);
  });
});

describe("suggestLimit", () => {
  it.each([
    [1, 1000],
    [12000, 12000],
    [12001, 13000],
    [37000, 37000],
    [49999, 50000],
    [50000, 50000],
    [50001, 55000],
    [123456, 125000],
  ])("rounds %i up to %i", (average, expected) => {
    expect(suggestLimit(average)).toBe(expected);
  });
});

describe("budgetReport: a month that is over", () => {
  const rows = [
    row("2026-03-05", -64000, { category: FOOD }),
    row("2026-03-20", -35000, { category: PETS }),
    row("2026-03-21", 5000, { category: PETS, kind: "CARD_REFUND" }),
    row("2026-03-22", -9000, { category: FUN }),
    row("2026-03-23", -2500),
    row("2026-03-24", -70000, { category: OWN, kind: "PIX_SENT" }),
    row("2026-03-25", -100000, { kind: "BILL_PAYMENT" }),
  ];
  const entries = [limit(FOOD, "2026-01", 80000), limit(PETS, "2026-01", 25000), limit(TRAVEL, "2026-01", 50000)];
  const report = budgetReport({ rows, entries, categories: CATEGORIES, month: "2026-03", currentMonth: "2026-04" });
  const byName = new Map(report.budgeted.map((entry) => [entry.category.name, entry]));

  it("has no pace", () => {
    expect(report.pace).toBeNull();
    expect(report.budgeted.every((entry) => entry.dailyRemainingCents === null)).toBe(true);
  });

  it("computes spending, what is left and the fraction used", () => {
    expect(byName.get("Food")).toMatchObject({
      limitCents: 80000,
      spentCents: 64000,
      remainingCents: 16000,
      usedFraction: 0.8,
      status: "ON_TRACK",
    });
  });

  it("subtracts refunds and flags a category over its limit", () => {
    expect(byName.get("Pets")).toMatchObject({ spentCents: 30000, remainingCents: -5000, status: "OVER" });
    expect(byName.get("Pets")!.usedFraction).toBeCloseTo(1.2);
  });

  it("lists a budgeted category without spending", () => {
    expect(byName.get("Travel")).toMatchObject({ spentCents: 0, remainingCents: 50000, usedFraction: 0, status: "ON_TRACK" });
  });

  it("orders by fraction used", () => {
    expect(report.budgeted.map((entry) => entry.category.name)).toEqual(["Pets", "Food", "Travel"]);
  });

  it("totals only the budgeted categories", () => {
    expect(report.totals).toEqual({ limitCents: 155000, spentCents: 94000, remainingCents: 61000 });
  });

  it("lists spending without a limit, and never what does not count as spending", () => {
    expect(report.unbudgeted.map((entry) => [entry.category.name, entry.spentCents])).toEqual([["Fun", 9000]]);
    expect(report.uncategorizedCents).toBe(2500);
  });
});

describe("budgetReport: the month in progress", () => {
  // Data up to the 10th of a 30-day month: a third of the month has passed.
  const base = [row("2026-04-10", -100, { category: TRAVEL })];
  const entries = [
    limit(FOOD, "2026-01", 100000),
    limit(PETS, "2026-01", 100000),
    limit(FUN, "2026-01", 100000),
    limit(TRAVEL, "2026-01", 100000),
  ];
  const report = budgetReport({
    rows: [
      ...base,
      row("2026-04-03", -80000, { category: FOOD }),
      row("2026-04-04", -40000, { category: PETS }),
      row("2026-04-05", -120000, { category: FUN }),
    ],
    entries,
    categories: CATEGORIES,
    month: "2026-04",
    currentMonth: "2026-04",
  });
  const byName = new Map(report.budgeted.map((entry) => [entry.category.name, entry]));

  it("measures the month up to the latest transaction", () => {
    expect(report.pace).toEqual({ asOf: "2026-04-10", monthFraction: 10 / 30, daysLeft: 20 });
  });

  it("asks for attention when well ahead of the pace", () => {
    expect(byName.get("Food")!.status).toBe("ATTENTION");
    expect(byName.get("Pets")!.status).toBe("ON_TRACK");
    expect(byName.get("Fun")!.status).toBe("OVER");
  });

  it("does not ask for attention below half of the limit, even ahead of the pace", () => {
    const early = budgetReport({
      rows: [row("2026-04-02", -45000, { category: FOOD })],
      entries,
      categories: CATEGORIES,
      month: "2026-04",
      currentMonth: "2026-04",
    });
    expect(early.pace?.monthFraction).toBeCloseTo(2 / 30);
    expect(early.budgeted.find((entry) => entry.category.id === FOOD.id)!.status).toBe("ON_TRACK");
  });

  it("spreads what is left over the remaining days", () => {
    expect(byName.get("Food")!.dailyRemainingCents).toBe(1000);
    expect(byName.get("Pets")!.dailyRemainingCents).toBe(3000);
    expect(byName.get("Fun")!.dailyRemainingCents).toBeNull();
  });

  it("has no daily figure on the last day", () => {
    const lastDay = budgetReport({
      rows: [row("2026-04-30", -10000, { category: FOOD })],
      entries,
      categories: CATEGORIES,
      month: "2026-04",
      currentMonth: "2026-04",
    });
    expect(lastDay.pace).toMatchObject({ monthFraction: 1, daysLeft: 0 });
    expect(lastDay.budgeted.find((entry) => entry.category.id === FOOD.id)!.dailyRemainingCents).toBeNull();
  });

  it("has no pace without any transaction in the month", () => {
    const empty = budgetReport({ rows: [], entries, categories: CATEGORIES, month: "2026-04", currentMonth: "2026-04" });
    expect(empty.pace).toBeNull();
    expect(empty.budgeted.every((entry) => entry.status === "ON_TRACK" && entry.spentCents === 0)).toBe(true);
  });
});

describe("budgetReport: suggestions and income", () => {
  const rows = [
    row("2026-01-05", -30000, { category: FOOD }),
    row("2026-02-05", -42000, { category: FOOD }),
    row("2026-01-06", 400000),
    row("2026-02-06", 600000),
    row("2026-03-05", -50000, { category: FOOD }),
    row("2026-03-06", -8000, { category: FUN }),
  ];

  it("suggests a limit from the average of the earlier months", () => {
    const report = budgetReport({ rows, entries: [], categories: CATEGORIES, month: "2026-03", currentMonth: "2026-04" });
    const byName = new Map(report.unbudgeted.map((entry) => [entry.category.name, entry.suggestedCents]));

    expect(byName.get("Food")).toBe(36000);
    // Never spent before: nothing to base a suggestion on.
    expect(byName.get("Fun")).toBeNull();
  });

  it("offers the suggestion for budgeted categories too", () => {
    const report = budgetReport({
      rows,
      entries: [limit(FOOD, "2026-01", 40000)],
      categories: CATEGORIES,
      month: "2026-03",
      currentMonth: "2026-04",
    });
    expect(report.budgeted[0].suggestedCents).toBe(36000);
  });

  it("has no suggestion in the first month of data", () => {
    const report = budgetReport({ rows, entries: [], categories: CATEGORIES, month: "2026-01", currentMonth: "2026-04" });
    expect(report.unbudgeted.every((entry) => entry.suggestedCents === null)).toBe(true);
  });

  it("compares what is planned with the average income of the earlier months", () => {
    const report = budgetReport({
      rows,
      entries: [limit(FOOD, "2026-01", 40000), limit(PETS, "2026-01", 60000)],
      categories: CATEGORIES,
      month: "2026-03",
      currentMonth: "2026-04",
    });
    expect(report.plannedShareOfIncome).toBeCloseTo(100000 / 500000);
  });

  it("has no income comparison without income or without limits", () => {
    const noLimits = budgetReport({ rows, entries: [], categories: CATEGORIES, month: "2026-03", currentMonth: "2026-04" });
    expect(noLimits.plannedShareOfIncome).toBeNull();

    const noIncome = budgetReport({
      rows: rows.filter((entry) => entry.amountCents < 0),
      entries: [limit(FOOD, "2026-01", 40000)],
      categories: CATEGORIES,
      month: "2026-03",
      currentMonth: "2026-04",
    });
    expect(noIncome.plannedShareOfIncome).toBeNull();
  });

  it("ignores a limit on a category that does not count as spending", () => {
    const report = budgetReport({
      rows,
      entries: [limit(OWN, "2026-01", 40000)],
      categories: CATEGORIES,
      month: "2026-03",
      currentMonth: "2026-04",
    });
    expect(report.budgeted).toEqual([]);
  });
});

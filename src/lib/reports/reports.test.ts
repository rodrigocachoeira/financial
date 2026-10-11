import { describe, expect, it } from "vitest";
import type { TransactionKind } from "../ofx";
import { addMonths, monthsEndingAt } from "./months";
import {
  futureInstallments,
  monthlyEvolution,
  monthSummary,
  niceCeiling,
  recurringSpending,
  spendingByCategory,
  spendingChange,
  topMerchants,
  type ReportCategory,
  type ReportRow,
} from "./reports";

const category = (name: string, countsAsSpending = true): ReportCategory => ({
  id: name.toLowerCase(),
  name,
  color: "#000000",
  countsAsSpending,
});

const FOOD = category("Food");
const PETS = category("Pets");
const FEES = category("Fees");
const OWN = category("Own transfers", false);

let nextId = 0;
function row(date: string, amountCents: number, options: Partial<ReportRow> = {}): ReportRow {
  nextId += 1;
  const kind: TransactionKind = amountCents < 0 ? "CARD_PURCHASE" : "PIX_RECEIVED";
  return {
    date,
    amountCents,
    kind,
    merchant: "SHOP",
    category: null,
    purchaseId: `purchase-${nextId}`,
    installment: null,
    ...options,
  };
}

describe("month helpers", () => {
  it("adds and subtracts months across years", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-06", 0)).toBe("2026-06");
    expect(addMonths("2026-12", 12)).toBe("2027-12");
  });

  it("lists the months that end at a month", () => {
    expect(monthsEndingAt("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("monthSummary", () => {
  const rows = [
    row("2026-01-05", -10000, { category: FOOD }),
    row("2026-01-06", -2500),
    row("2026-01-07", 3000, { kind: "CARD_REFUND" }),
    row("2026-01-08", 500000, { kind: "PIX_RECEIVED" }),
    row("2026-01-10", -125000, { kind: "BILL_PAYMENT" }),
    row("2026-01-10", 125000, { kind: "CARD_PAYMENT_RECEIVED" }),
    row("2026-01-11", -70000, { kind: "PIX_SENT", category: OWN }),
    row("2026-01-12", 40000, { kind: "PIX_RECEIVED", category: OWN }),
    row("2026-02-01", -99999),
  ];

  it("adds outflows, subtracts refunds and separates income", () => {
    expect(monthSummary(rows, "2026-01")).toEqual({ spentCents: 9500, incomeCents: 500000, netCents: 490500 });
  });

  it("is zero for a month without data", () => {
    expect(monthSummary(rows, "2025-06")).toEqual({ spentCents: 0, incomeCents: 0, netCents: 0 });
  });
});

describe("spendingChange", () => {
  const rows = [row("2026-01-05", -20000), row("2026-02-05", -25000), row("2026-04-05", -100)];

  it("compares with the previous month", () => {
    expect(spendingChange(rows, "2026-02")).toBeCloseTo(0.25);
    expect(spendingChange(rows, "2026-03")).toBe(-1);
  });

  it("is null when the previous month has no spending", () => {
    expect(spendingChange(rows, "2026-01")).toBeNull();
    expect(spendingChange(rows, "2026-04")).toBeNull();
  });
});

describe("spendingByCategory", () => {
  const rows = [
    row("2026-01-05", -6000, { category: FOOD }),
    row("2026-01-06", -4000, { category: FOOD }),
    row("2026-01-07", -30000, { category: PETS }),
    row("2026-01-08", -50000),
    row("2026-01-09", -420, { category: FEES }),
    row("2026-01-09", 420, { category: FEES, kind: "CARD_REFUND" }),
    row("2026-01-10", -80000, { category: OWN }),
    row("2026-01-11", 2000, { category: PETS, kind: "CARD_REFUND" }),
    row("2026-02-01", -1, { category: FOOD }),
  ];

  it("orders by spending with uncategorized last and leaves out what nets to zero", () => {
    const result = spendingByCategory(rows, "2026-01");
    expect(result.map((entry) => [entry.category?.name ?? null, entry.spentCents])).toEqual([
      ["Pets", 28000],
      ["Food", 10000],
      [null, 50000],
    ]);
  });

  it("computes the share of the month's spending", () => {
    const result = spendingByCategory(rows, "2026-01");
    expect(result.map((entry) => entry.share)).toEqual([28000 / 88000, 10000 / 88000, 50000 / 88000]);
  });

  it("is empty for a month without spending", () => {
    expect(spendingByCategory(rows, "2025-01")).toEqual([]);
  });
});

describe("monthlyEvolution", () => {
  it("returns exactly the requested months, zero when there is no data", () => {
    const rows = [row("2026-01-05", -1000), row("2026-03-05", -3000), row("2026-03-06", 500, { kind: "CARD_REFUND" })];
    expect(monthlyEvolution(rows, "2026-03", 4)).toEqual([
      { month: "2025-12", spentCents: 0 },
      { month: "2026-01", spentCents: 1000 },
      { month: "2026-02", spentCents: 0 },
      { month: "2026-03", spentCents: 2500 },
    ]);
  });
});

describe("topMerchants", () => {
  const rows = [
    row("2026-01-05", -5000, { merchant: "A", category: FOOD }),
    row("2026-01-06", -5000, { merchant: "A", category: FOOD }),
    row("2026-01-07", 4000, { merchant: "A", category: FOOD, kind: "CARD_REFUND" }),
    row("2026-01-07", -9000, { merchant: "B" }),
    row("2026-01-08", -1000, { merchant: "C" }),
    row("2026-01-08", -99999, { merchant: null }),
    row("2026-01-09", -3000, { merchant: "D" }),
    row("2026-01-09", 3000, { merchant: "D", kind: "CARD_REFUND" }),
    row("2026-01-09", -70000, { merchant: "OWN ACCOUNT", category: OWN }),
    row("2026-02-01", -99999, { merchant: "E" }),
  ];

  it("ranks merchants by net spending and ignores the ones without a name", () => {
    expect(topMerchants(rows, "2026-01", 10)).toEqual([
      { merchant: "B", category: null, transactionCount: 1, spentCents: 9000 },
      { merchant: "A", category: FOOD, transactionCount: 2, spentCents: 6000 },
      { merchant: "C", category: null, transactionCount: 1, spentCents: 1000 },
    ]);
  });

  it("respects the limit", () => {
    expect(topMerchants(rows, "2026-01", 2).map((entry) => entry.merchant)).toEqual(["B", "A"]);
  });
});

describe("recurringSpending", () => {
  const monthly = (merchant: string, months: string[], cents = -3990, options: Partial<ReportRow> = {}) =>
    months.map((month) => row(`${month}-10`, cents, { merchant, ...options }));

  it("finds a merchant charged three months in a row", () => {
    const rows = monthly("STREAMING", ["2026-01", "2026-02", "2026-03"], -3990, { category: FOOD });
    expect(recurringSpending(rows, "2026-03")).toEqual([
      {
        merchant: "STREAMING",
        category: FOOD,
        months: 3,
        averageCents: 3990,
        lastCents: 3990,
        previousCents: 3990,
        priceChange: 0,
        lastDate: "2026-03-10",
        nextDate: "2026-04-10",
        yearlyCents: 47880,
      },
    ]);
  });

  it("accepts a run that ended the month before", () => {
    const rows = monthly("STREAMING", ["2026-01", "2026-02", "2026-03"]);
    expect(recurringSpending(rows, "2026-04")).toHaveLength(1);
    expect(recurringSpending(rows, "2026-05")).toEqual([]);
  });

  it("tolerates small changes in the amount and averages them", () => {
    const rows = [
      ...monthly("GYM", ["2026-01"], -10000),
      ...monthly("GYM", ["2026-02"], -11000),
      ...monthly("GYM", ["2026-03"], -9500),
    ];
    expect(recurringSpending(rows, "2026-03")[0]).toMatchObject({ averageCents: 10167, lastCents: 9500, months: 3 });
  });

  it.each([
    ["only two months", monthly("X", ["2026-02", "2026-03"])],
    ["a gap in the middle", monthly("X", ["2025-12", "2026-01", "2026-03"])],
    [
      "an amount outside the tolerance",
      [...monthly("X", ["2026-01", "2026-02"], -1000), ...monthly("X", ["2026-03"], -5000)],
    ],
    [
      "installments",
      ["2026-01", "2026-02", "2026-03"].map((month, index) =>
        row(`${month}-10`, -8990, { merchant: "X", purchaseId: "p", installment: { number: index + 1, total: 10 } }),
      ),
    ],
    ["a category that is not spending", monthly("X", ["2026-01", "2026-02", "2026-03"], -1000, { category: OWN })],
  ])("does not report %s", (_reason, rows) => {
    expect(recurringSpending(rows, "2026-03")).toEqual([]);
  });

  it("uses only the most recent run", () => {
    const rows = monthly("X", ["2025-09", "2025-10", "2025-12", "2026-01", "2026-02", "2026-03"]);
    expect(recurringSpending(rows, "2026-03")[0].months).toBe(4);
  });

  it("orders by monthly cost", () => {
    const rows = [
      ...monthly("CHEAP", ["2026-01", "2026-02", "2026-03"], -1000),
      ...monthly("EXPENSIVE", ["2026-01", "2026-02", "2026-03"], -9000),
    ];
    expect(recurringSpending(rows, "2026-03").map((entry) => entry.merchant)).toEqual(["EXPENSIVE", "CHEAP"]);
  });
});

describe("futureInstallments", () => {
  const installment = (date: string, number: number, total: number, cents: number, purchaseId: string, merchant = "STORE") =>
    row(date, cents, { merchant, purchaseId, installment: { number, total } });

  it("projects the remaining installments one per month", () => {
    const rows = [installment("2026-01-11", 2, 10, -8990, "a"), installment("2026-02-11", 3, 10, -8990, "a")];
    const result = futureInstallments(rows, "2026-02", 12);

    expect(result.purchases).toEqual([
      { merchant: "STORE", currentNumber: 3, total: 10, remaining: 7, monthlyCents: 8990, endMonth: "2026-09" },
    ]);
    expect(result.byMonth).toHaveLength(12);
    expect(result.byMonth.slice(0, 8)).toEqual([
      { month: "2026-03", cents: 8990 },
      { month: "2026-04", cents: 8990 },
      { month: "2026-05", cents: 8990 },
      { month: "2026-06", cents: 8990 },
      { month: "2026-07", cents: 8990 },
      { month: "2026-08", cents: 8990 },
      { month: "2026-09", cents: 8990 },
      { month: "2026-10", cents: 0 },
    ]);
    expect(result.totalCents).toBe(7 * 8990);
  });

  it("ignores purchases already paid off", () => {
    const rows = [installment("2026-02-25", 11, 12, -31000, "b"), installment("2026-02-25", 12, 12, -31000, "b")];
    expect(futureInstallments(rows, "2026-02", 12)).toMatchObject({ purchases: [], totalCents: 0 });
  });

  it("skips what is already past the reference month when the history is stale", () => {
    const rows = [installment("2026-01-10", 1, 4, -1000, "c")];
    const result = futureInstallments(rows, "2026-03", 6);

    expect(result.purchases[0]).toMatchObject({ currentNumber: 1, remaining: 1, endMonth: "2026-04" });
    expect(result.byMonth[0]).toEqual({ month: "2026-04", cents: 1000 });
    expect(result.totalCents).toBe(1000);
  });

  it("adds up several purchases and orders them by what is left to pay", () => {
    const rows = [
      installment("2026-02-10", 3, 10, -8990, "a", "SMALL"),
      installment("2026-02-10", 5, 12, -100000, "d", "BIG"),
    ];
    const result = futureInstallments(rows, "2026-02", 3);

    expect(result.purchases.map((purchase) => purchase.merchant)).toEqual(["BIG", "SMALL"]);
    expect(result.byMonth).toEqual([
      { month: "2026-03", cents: 108990 },
      { month: "2026-04", cents: 108990 },
      { month: "2026-05", cents: 108990 },
    ]);
    expect(result.totalCents).toBe(7 * 8990 + 7 * 100000);
  });

  it("is empty without installments", () => {
    const result = futureInstallments([row("2026-02-10", -1000)], "2026-02", 2);
    expect(result).toEqual({
      byMonth: [
        { month: "2026-03", cents: 0 },
        { month: "2026-04", cents: 0 },
      ],
      purchases: [],
      totalCents: 0,
    });
  });
});

describe("niceCeiling", () => {
  it.each([
    [0, 1],
    [7, 10],
    [86417, 100000],
    [120000, 200000],
    [230000, 250000],
    [450000, 500000],
    [500000, 500000],
    [623468, 1000000],
  ])("rounds %i up to %i", (value, expected) => {
    expect(niceCeiling(value)).toBe(expected);
  });
});

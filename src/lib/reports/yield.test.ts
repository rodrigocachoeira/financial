import { describe, expect, it } from "vitest";
import { hasMultiMonthStatement, monthYield, yieldEvolution, type YieldSource } from "./yield";

const statement = (periodStart: string, periodEnd: string, netYieldCents: number, importedAt = "2026-10-11T10:00:00.000Z"): YieldSource => ({
  periodStart,
  periodEnd,
  netYieldCents,
  importedAt,
});

describe("monthYield", () => {
  it("takes the figure of the statement that covers the month", () => {
    const sources = [statement("2026-09-01", "2026-09-30", 4321), statement("2026-08-01", "2026-08-31", 3999)];
    expect(monthYield(sources, "2026-09")).toEqual({ month: "2026-09", cents: 4321, partialUntil: null });
    expect(monthYield(sources, "2026-08")).toEqual({ month: "2026-08", cents: 3999, partialUntil: null });
  });

  it("is empty without a statement of the month", () => {
    expect(monthYield([statement("2026-09-01", "2026-09-30", 4321)], "2026-10")).toEqual({
      month: "2026-10",
      cents: null,
      partialUntil: null,
    });
    expect(monthYield([], "2026-10").cents).toBeNull();
  });

  it("flags a statement that stops before the end of the month", () => {
    expect(monthYield([statement("2026-10-01", "2026-10-10", 1200)], "2026-10")).toEqual({
      month: "2026-10",
      cents: 1200,
      partialUntil: "2026-10-10",
    });
  });

  it("knows the last day of every month, leap years included", () => {
    expect(monthYield([statement("2026-02-01", "2026-02-28", 1)], "2026-02").partialUntil).toBeNull();
    expect(monthYield([statement("2028-02-01", "2028-02-28", 1)], "2028-02").partialUntil).toBe("2028-02-28");
    expect(monthYield([statement("2028-02-01", "2028-02-29", 1)], "2028-02").partialUntil).toBeNull();
    expect(monthYield([statement("2026-04-01", "2026-04-30", 1)], "2026-04").partialUntil).toBeNull();
  });

  it("replaces a partial statement with a fuller one instead of adding them", () => {
    const sources = [
      statement("2026-10-01", "2026-10-10", 1200),
      statement("2026-10-01", "2026-10-31", 3800),
      statement("2026-10-01", "2026-10-20", 2500),
    ];
    expect(monthYield(sources, "2026-10")).toEqual({ month: "2026-10", cents: 3800, partialUntil: null });
    expect(monthYield([...sources].reverse(), "2026-10").cents).toBe(3800);
  });

  it("prefers, for the same end, the statement that starts earlier, then the latest import", () => {
    expect(
      monthYield([statement("2026-10-05", "2026-10-31", 3000), statement("2026-10-01", "2026-10-31", 3800)], "2026-10").cents,
    ).toBe(3800);
    expect(
      monthYield(
        [
          statement("2026-10-01", "2026-10-31", 3800, "2026-11-01T10:00:00.000Z"),
          statement("2026-10-01", "2026-10-31", 3805, "2026-11-02T10:00:00.000Z"),
        ],
        "2026-10",
      ).cents,
    ).toBe(3805);
  });

  it("ignores a statement that spans more than one month", () => {
    expect(monthYield([statement("2026-08-01", "2026-10-10", 9000)], "2026-09").cents).toBeNull();
    expect(monthYield([statement("2026-08-01", "2026-10-10", 9000)], "2026-08").cents).toBeNull();
  });

  it("keeps a zero yield as zero, not as missing", () => {
    expect(monthYield([statement("2026-09-01", "2026-09-30", 0)], "2026-09").cents).toBe(0);
  });
});

describe("yieldEvolution", () => {
  it("lists the months in order, with gaps where nothing was imported", () => {
    const sources = [statement("2026-08-01", "2026-08-31", 3999), statement("2026-10-01", "2026-10-10", 1200)];
    expect(yieldEvolution(sources, "2026-10", 4)).toEqual([
      { month: "2026-07", cents: null, partialUntil: null },
      { month: "2026-08", cents: 3999, partialUntil: null },
      { month: "2026-09", cents: null, partialUntil: null },
      { month: "2026-10", cents: 1200, partialUntil: "2026-10-10" },
    ]);
  });
});

describe("hasMultiMonthStatement", () => {
  it("detects a statement spanning months inside the window", () => {
    expect(hasMultiMonthStatement([statement("2026-08-01", "2026-10-10", 9000)], "2026-10", 6)).toBe(true);
    expect(hasMultiMonthStatement([statement("2026-09-01", "2026-09-30", 1)], "2026-10", 6)).toBe(false);
    expect(hasMultiMonthStatement([statement("2025-01-01", "2025-03-31", 1)], "2026-10", 6)).toBe(false);
    expect(hasMultiMonthStatement([], "2026-10", 6)).toBe(false);
  });
});

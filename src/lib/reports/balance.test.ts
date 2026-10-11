import { describe, expect, it } from "vitest";
import { balanceEvolution, monthBalance, type BalanceSource } from "./balance";

const closing = (date: string, cents: number, importedAt = "2026-10-11T10:00:00.000Z"): BalanceSource => ({
  date,
  cents,
  importedAt,
});

describe("monthBalance", () => {
  it("takes the balance of the latest day reported in the month", () => {
    const sources = [closing("2026-10-10", 150000), closing("2026-10-31", 210000), closing("2026-09-30", 90000)];
    expect(monthBalance(sources, "2026-10")).toEqual({ month: "2026-10", cents: 210000, date: "2026-10-31" });
    expect(monthBalance([...sources].reverse(), "2026-10").cents).toBe(210000);
    expect(monthBalance(sources, "2026-09")).toEqual({ month: "2026-09", cents: 90000, date: "2026-09-30" });
  });

  it("prefers the latest import for the same day", () => {
    const sources = [
      closing("2026-10-31", 210000, "2026-11-01T00:00:00.000Z"),
      closing("2026-10-31", 210500, "2026-11-02T00:00:00.000Z"),
    ];
    expect(monthBalance(sources, "2026-10").cents).toBe(210500);
  });

  it("is empty without a statement closing in the month", () => {
    expect(monthBalance([closing("2026-09-30", 1)], "2026-10")).toEqual({ month: "2026-10", cents: null, date: null });
  });

  it("keeps a zero or negative balance as it is", () => {
    expect(monthBalance([closing("2026-10-31", 0)], "2026-10").cents).toBe(0);
    expect(monthBalance([closing("2026-10-31", -500)], "2026-10").cents).toBe(-500);
  });
});

describe("balanceEvolution", () => {
  it("lists the months in order, with gaps", () => {
    expect(balanceEvolution([closing("2026-08-31", 100), closing("2026-10-10", 300)], "2026-10", 3)).toEqual([
      { month: "2026-08", cents: 100, date: "2026-08-31" },
      { month: "2026-09", cents: null, date: null },
      { month: "2026-10", cents: 300, date: "2026-10-10" },
    ]);
  });
});

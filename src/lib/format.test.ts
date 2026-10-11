import { describe, expect, it } from "vitest";
import {
  formatCents,
  formatCompactCents,
  formatDate,
  formatDay,
  formatMonth,
  formatPercent,
  formatShortMonth,
  parseMonth,
  parseReais,
} from "./format";

// Intl uses a non-breaking space after the currency symbol.
const plain = (text: string) => text.replace(/ /g, " ");

describe("formatCents", () => {
  it.each([
    [-4590, "-R$ 45,90"],
    [125037, "R$ 1.250,37"],
    [0, "R$ 0,00"],
    [7, "R$ 0,07"],
    [-100000000, "-R$ 1.000.000,00"],
  ])("formats %i as %s", (cents, expected) => {
    expect(plain(formatCents(cents))).toBe(expected);
  });
});

describe("formatDate", () => {
  it("formats an ISO date as DD/MM/YYYY", () => {
    expect(formatDate("2026-01-05")).toBe("05/01/2026");
    expect(formatDate("2026-12-31")).toBe("31/12/2026");
  });
});

describe("formatDay", () => {
  it("formats weekday, day and month in Portuguese", () => {
    expect(formatDay("2026-01-25")).toBe("domingo, 25 de janeiro");
    expect(formatDay("2026-03-02")).toBe("segunda-feira, 2 de março");
  });
});

describe("formatMonth", () => {
  it("formats a month in Portuguese", () => {
    expect(formatMonth("2026-01")).toBe("janeiro de 2026");
    expect(formatMonth("2026-12")).toBe("dezembro de 2026");
  });
});

describe("parseMonth", () => {
  it("returns the first day and the first day of the next month", () => {
    expect(parseMonth("2026-01")).toEqual({ start: "2026-01-01", endExclusive: "2026-02-01" });
    expect(parseMonth("2026-09")).toEqual({ start: "2026-09-01", endExclusive: "2026-10-01" });
  });

  it("rolls December over to the next year", () => {
    expect(parseMonth("2026-12")).toEqual({ start: "2026-12-01", endExclusive: "2027-01-01" });
  });

  it.each(["2026-13", "2026-00", "abc", "2026-1", "2026-01-05", "", undefined])("rejects %j", (value) => {
    expect(parseMonth(value)).toBeNull();
  });
});

describe("formatCompactCents", () => {
  it("shortens large amounts", () => {
    expect(plain(formatCompactCents(250000))).toBe("R$ 2,5 mil");
    expect(plain(formatCompactCents(100000))).toBe("R$ 1 mil");
    expect(plain(formatCompactCents(50000))).toBe("R$ 500");
    expect(plain(formatCompactCents(0))).toBe("R$ 0");
  });
});

describe("formatPercent", () => {
  it("formats a fraction as a whole percentage", () => {
    expect(formatPercent(0.124)).toBe("12%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("formatShortMonth", () => {
  it("abbreviates the month without a trailing period", () => {
    expect(formatShortMonth("2026-01")).toBe("jan");
    expect(formatShortMonth("2026-09")).toBe("set");
    expect(formatShortMonth("2026-12")).toBe("dez");
  });
});

describe("parseReais", () => {
  it.each([
    ["800", 80000],
    ["800,5", 80050],
    ["800,50", 80050],
    ["1.200", 120000],
    ["1.200,50", 120050],
    ["1200,50", 120050],
    ["R$ 45,90", 4590],
    [" 12.345.678,09 ", 1234567809],
    ["0", 0],
  ])("reads %j as %i cents", (text, expected) => {
    expect(parseReais(text)).toBe(expected);
  });

  it.each(["", "abc", "12,345", "1.2", "1,2,3", "-50", "12.34.567", "R$"])("rejects %j", (text) => {
    expect(parseReais(text)).toBeNull();
  });
});

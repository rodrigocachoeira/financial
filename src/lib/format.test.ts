import { describe, expect, it } from "vitest";
import { formatCents, formatDate, formatMonth, parseMonth } from "./format";

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

import { describe, expect, it } from "vitest";
import { toCents } from "./money";

describe("toCents", () => {
  it.each([
    ["5000.00", 500000],
    ["-45.90", -4590],
    ["-1250.37", -125037],
    ["0.07", 7],
    ["-32", -3200],
    ["12.5", 1250],
    ["-0.00", 0],
  ])("converts %s to %i", (input, expected) => {
    expect(toCents(input)).toBe(expected);
  });

  it.each(["", "abc", "1,50", "1.234", "--1"])("rejects %j", (input) => {
    expect(() => toCents(input)).toThrow("Invalid amount format");
  });
});

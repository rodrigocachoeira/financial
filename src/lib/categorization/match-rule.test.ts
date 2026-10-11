import { describe, expect, it } from "vitest";
import { matchRule, type Rule } from "./match-rule";

const rules: Rule[] = [
  { pattern: "IFD", categoryId: "food" },
  { pattern: "RESTAURANTE", categoryId: "food" },
  { pattern: "UBER", categoryId: "transport" },
  { pattern: "UBER EATS", categoryId: "food" },
  { pattern: "AMAZON", categoryId: "shopping" },
  { pattern: "AMAZON PRIME", categoryId: "subscriptions" },
  { pattern: "SUPERMERC", categoryId: "groceries" },
  { pattern: "IOF", categoryId: "fees" },
  { pattern: "POSTO", categoryId: "transport" },
];

describe("matchRule", () => {
  it.each([
    ["IFD *RESTAURANTE EXEMPLO", "food"],
    ["UBER *TRIP", "transport"],
    ["UBER EATS", "food"],
    ["AMAZON PRIME BR", "subscriptions"],
    ["AMAZON MARKETPLACE", "shopping"],
    ["SUPERMERCADO BOM PRECO", "groceries"],
    ["MP *POSTO CENTRAL", "transport"],
    ["PG*UBER", "transport"],
    ["IOF DE COMPRA INTERNACIONAL", "fees"],
  ])("matches %s to %s", (name, expected) => {
    expect(matchRule(name, rules)).toBe(expected);
  });

  it.each(["MP *LOJAEXEMPLO", "FULANO DE TAL", "BIOFARMA", "COMPOSTO LTDA", "XUBER", ""])(
    "does not match %j",
    (name) => {
      expect(matchRule(name, rules)).toBeNull();
    },
  );

  it("ignores case in the name and in the pattern", () => {
    expect(matchRule("uber *trip", [{ pattern: "Uber", categoryId: "transport" }])).toBe("transport");
  });

  it("prefers the longest pattern regardless of rule order", () => {
    expect(matchRule("UBER EATS", [...rules].reverse())).toBe("food");
  });

  it("breaks ties between patterns of the same length alphabetically", () => {
    const tied: Rule[] = [
      { pattern: "LOJA B", categoryId: "second" },
      { pattern: "LOJA A", categoryId: "first" },
    ];
    expect(matchRule("LOJA A LOJA B", tied)).toBe("first");
    expect(matchRule("LOJA B LOJA A", tied)).toBe("first");
  });

  it("returns null without rules", () => {
    expect(matchRule("UBER", [])).toBeNull();
  });
});

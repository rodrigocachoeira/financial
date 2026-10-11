import { describe, expect, it } from "vitest";
import {
  CATEGORY_COLORS,
  CATEGORY_NAME_MAX_LENGTH,
  cleanCategoryName,
  isCategoryColor,
  matchesSearch,
  pickCategoryColor,
  searchKey,
  validateCategoryName,
} from "./category-name";

describe("cleanCategoryName", () => {
  it("trims and collapses spaces, keeping case and accents", () => {
    expect(cleanCategoryName("  Casa   e  Jardim ")).toBe("Casa e Jardim");
    expect(cleanCategoryName("Alimentação")).toBe("Alimentação");
  });
});

describe("searchKey", () => {
  it.each(["Alimentação", "alimentacao", " ALIMENTAÇÃO ", "Alimentaçao"])("is the same for %j", (name) => {
    expect(searchKey(name)).toBe("alimentacao");
  });

  it("differs for different names", () => {
    expect(searchKey("Mercado")).not.toBe(searchKey("Mercados"));
  });
});

describe("validateCategoryName", () => {
  it("accepts ordinary names", () => {
    expect(validateCategoryName("Viagens")).toBeNull();
    expect(validateCategoryName("a".repeat(CATEGORY_NAME_MAX_LENGTH))).toBeNull();
  });

  it.each(["", "   ", "\n"])("rejects the empty name %j", (name) => {
    expect(validateCategoryName(name)).toBe("EMPTY");
  });

  it("rejects a name that is too long", () => {
    expect(validateCategoryName("a".repeat(CATEGORY_NAME_MAX_LENGTH + 1))).toBe("TOO_LONG");
  });
});

describe("matchesSearch", () => {
  it("ignores accents and case", () => {
    expect(matchesSearch("Alimentação", "alimenta")).toBe(true);
    expect(matchesSearch("Serviços e taxas", "SERVICOS")).toBe(true);
    expect(matchesSearch("Saúde", "ude")).toBe(true);
  });

  it("matches everything for an empty query", () => {
    expect(matchesSearch("Pets", "")).toBe(true);
    expect(matchesSearch("Pets", "   ")).toBe(true);
  });

  it("rejects what is not contained", () => {
    expect(matchesSearch("Pets", "viagem")).toBe(false);
  });
});

describe("category colors", () => {
  it("has no repeated color", () => {
    expect(new Set(CATEGORY_COLORS).size).toBe(CATEGORY_COLORS.length);
  });

  it("recognizes palette colors only", () => {
    expect(isCategoryColor(CATEGORY_COLORS[0])).toBe(true);
    expect(isCategoryColor("#123456")).toBe(false);
    expect(isCategoryColor("red")).toBe(false);
    expect(isCategoryColor(undefined)).toBe(false);
  });

  it("picks the first color not in use", () => {
    expect(pickCategoryColor([])).toBe(CATEGORY_COLORS[0]);
    expect(pickCategoryColor([CATEGORY_COLORS[0], CATEGORY_COLORS[1]])).toBe(CATEGORY_COLORS[2]);
    expect(pickCategoryColor([CATEGORY_COLORS[1], "#000000"])).toBe(CATEGORY_COLORS[0]);
  });

  it("picks the least used color when all are taken", () => {
    const used = [...CATEGORY_COLORS, ...CATEGORY_COLORS.filter((_, index) => index !== 3)];
    expect(pickCategoryColor(used)).toBe(CATEGORY_COLORS[3]);
  });
});

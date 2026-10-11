import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATEGORY_COLORS } from "@/lib/categorization/category-name";
import { importFile } from "../imports/import-file";
import { categoryId, fixtureBytes, resetTestDb, testDb as db } from "../testing/test-db";
import { applyRules } from "./apply-rules";
import {
  CategoryError,
  createCategory,
  deleteCategory,
  findOrCreateCategory,
  listCategoriesWithUsage,
  updateCategory,
} from "./manage-categories";
import { setTransactionCategory } from "./set-transaction-category";

// Categories are seeded and shared by every test file: anything created here is removed again.
const created: string[] = [];
const track = <T extends { id: string }>(category: T) => {
  created.push(category.id);
  return category;
};

beforeEach(async () => {
  await resetTestDb();
});

afterEach(async () => {
  await db.category.deleteMany({ where: { id: { in: created.splice(0) } } });
});

afterAll(() => db.$disconnect());

const rejectsWith = async (promise: Promise<unknown>, code: string) =>
  expect(promise).rejects.toMatchObject({ name: "CategoryError", code });

describe("createCategory", () => {
  it("stores a cleaned name and picks a free palette color", async () => {
    const category = track(await createCategory(db, { name: "  Viagens   de férias " }));

    expect(category).toMatchObject({ name: "Viagens de férias", countsAsSpending: true });
    expect(CATEGORY_COLORS).toContain(category.color);
    const others = await db.category.findMany({ where: { id: { not: category.id } }, select: { color: true } });
    expect(others.map((other) => other.color)).not.toContain(category.color);
  });

  it("accepts a chosen color and the not-spending flag", async () => {
    const category = track(
      await createCategory(db, { name: "Investimentos", color: CATEGORY_COLORS[5], countsAsSpending: false }),
    );
    expect(category).toMatchObject({ color: CATEGORY_COLORS[5], countsAsSpending: false });
  });

  it.each(["Alimentação", "alimentacao", "  ALIMENTAÇÃO  "])("rejects the name %j, already taken", async (name) => {
    await rejectsWith(createCategory(db, { name }), "NAME_TAKEN");
  });

  it("rejects invalid input", async () => {
    await rejectsWith(Promise.resolve().then(() => createCategory(db, { name: "   " })), "NAME_EMPTY");
    await rejectsWith(Promise.resolve().then(() => createCategory(db, { name: "x".repeat(41) })), "NAME_TOO_LONG");
    await rejectsWith(
      Promise.resolve().then(() => createCategory(db, { name: "Nova", color: "#123456" })),
      "INVALID_COLOR",
    );
    expect(await db.category.count({ where: { name: "Nova" } })).toBe(0);
  });
});

describe("findOrCreateCategory", () => {
  it("returns the existing category for an equivalent name", async () => {
    const food = await categoryId("Alimentação");
    expect((await findOrCreateCategory(db, "alimentacao")).id).toBe(food);
  });

  it("creates the category when there is none, once", async () => {
    const first = track(await findOrCreateCategory(db, "Viagens"));
    const second = await findOrCreateCategory(db, " viagens ");

    expect(second.id).toBe(first.id);
    expect(first.name).toBe("Viagens");
  });
});

describe("updateCategory", () => {
  it("renames, recolors and changes the not-spending flag", async () => {
    const category = track(await createCategory(db, { name: "Viagens" }));

    const updated = await updateCategory(db, category.id, {
      name: "Viagens e passeios",
      color: CATEGORY_COLORS[7],
      countsAsSpending: false,
    });

    expect(updated).toEqual({
      id: category.id,
      name: "Viagens e passeios",
      color: CATEGORY_COLORS[7],
      countsAsSpending: false,
    });
  });

  it("allows changing only the case or accents of its own name", async () => {
    const category = track(await createCategory(db, { name: "viagens" }));
    expect((await updateCategory(db, category.id, { name: "Viagens" })).name).toBe("Viagens");
  });

  it("leaves untouched what is not given", async () => {
    const category = track(await createCategory(db, { name: "Viagens", color: CATEGORY_COLORS[2] }));
    expect(await updateCategory(db, category.id, { countsAsSpending: false })).toMatchObject({
      name: "Viagens",
      color: CATEGORY_COLORS[2],
      countsAsSpending: false,
    });
  });

  it("rejects the name of another category, an invalid color and an unknown id", async () => {
    const category = track(await createCategory(db, { name: "Viagens" }));

    await rejectsWith(updateCategory(db, category.id, { name: "ALIMENTACAO" }), "NAME_TAKEN");
    await rejectsWith(
      Promise.resolve().then(() => updateCategory(db, category.id, { color: "blue" })),
      "INVALID_COLOR",
    );
    await rejectsWith(updateCategory(db, "00000000-0000-7000-8000-000000000000", { name: "X" }), "NOT_FOUND");
    expect((await db.category.findUniqueOrThrow({ where: { id: category.id } })).name).toBe("Viagens");
  });
});

describe("deleteCategory", () => {
  it("returns its transactions and merchants to no category, manual corrections included", async () => {
    await importFile(db, { name: "card.ofx", bytes: fixtureBytes("credit-card.ofx") });
    const category = track(await createCategory(db, { name: "Viagens" }));
    const [first, second] = await db.transaction.findMany({
      where: { kind: "CARD_PURCHASE", categoryId: null },
      orderBy: { externalId: "asc" },
    });
    await setTransactionCategory(db, first.id, category.id);
    await setTransactionCategory(db, second.id, category.id);

    const affected = await deleteCategory(db, category.id);

    expect(affected).toBe(2);
    for (const transaction of [first, second]) {
      expect(await db.transaction.findUniqueOrThrow({ where: { id: transaction.id } })).toMatchObject({
        categoryId: null,
        categorySource: null,
      });
    }
    expect(await db.merchant.count({ where: { categoryId: category.id } })).toBe(0);
    expect(await db.category.findUnique({ where: { id: category.id } })).toBeNull();
    expect(await db.transaction.count()).toBe(5);
  });

  it("removes the default rules of the category and lets other rules apply afterwards", async () => {
    const category = track(await createCategory(db, { name: "Temporária" }));
    await db.categoryRule.create({ data: { pattern: "ZZZTESTE", categoryId: category.id } });

    await deleteCategory(db, category.id);

    expect(await db.categoryRule.count({ where: { pattern: "ZZZTESTE" } })).toBe(0);
    expect(await applyRules(db)).toBe(0);
  });

  it("rejects an unknown id", async () => {
    await rejectsWith(deleteCategory(db, "00000000-0000-7000-8000-000000000000"), "NOT_FOUND");
  });
});

describe("listCategoriesWithUsage", () => {
  it("counts transactions and merchants of each category, in alphabetical order", async () => {
    await importFile(db, { name: "card.ofx", bytes: fixtureBytes("credit-card.ofx") });

    const categories = await listCategoriesWithUsage(db);
    const byName = new Map(categories.map((category) => [category.name, category]));

    expect(byName.get("Alimentação")).toMatchObject({ transactionCount: 1, merchantCount: 1 });
    expect(byName.get("Assinaturas")).toMatchObject({ transactionCount: 1, merchantCount: 1 });
    expect(byName.get("Pets")).toMatchObject({ transactionCount: 0, merchantCount: 0 });
    expect(byName.get("Transferências próprias")?.countsAsSpending).toBe(false);
    const names = categories.map((category) => category.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });
});

describe("CategoryError", () => {
  it("carries a code", () => {
    expect(new CategoryError("NAME_TAKEN")).toMatchObject({ code: "NAME_TAKEN", name: "CategoryError" });
  });
});

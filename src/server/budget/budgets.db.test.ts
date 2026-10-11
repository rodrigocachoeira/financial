import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { budgetFor, budgetReport } from "@/lib/budget/budget";
import { listCategories } from "../categorization/list-categories";
import { createCategory, deleteCategory } from "../categorization/manage-categories";
import { importFile } from "../imports/import-file";
import { loadReportRows } from "../reports/load-report-rows";
import { categoryId, fixtureBytes, resetTestDb, testDb as db } from "../testing/test-db";
import { loadBudgets, setBudget } from "./budgets";

const createdCategories: string[] = [];

beforeEach(async () => {
  await resetTestDb();
  await db.budget.deleteMany();
});

afterEach(async () => {
  await db.category.deleteMany({ where: { id: { in: createdCategories.splice(0) } } });
});

afterAll(async () => {
  await db.budget.deleteMany();
  await db.$disconnect();
});

const rejectsWith = async (promise: Promise<unknown>, code: string) =>
  expect(promise).rejects.toMatchObject({ name: "BudgetError", code });

describe("setBudget", () => {
  it("creates a limit and replaces it within the same month", async () => {
    const food = await categoryId("Alimentação");

    await setBudget(db, food, "2026-01", 80000);
    await setBudget(db, food, "2026-01", 90000);

    expect(await loadBudgets(db)).toEqual([{ categoryId: food, startMonth: "2026-01", amountCents: 90000 }]);
  });

  it("keeps the limit of earlier months when it changes later", async () => {
    const food = await categoryId("Alimentação");
    await setBudget(db, food, "2026-01", 80000);

    await setBudget(db, food, "2026-03", 100000);

    const entries = await loadBudgets(db);
    expect(entries).toHaveLength(2);
    expect(budgetFor(entries, food, "2026-02")).toBe(80000);
    expect(budgetFor(entries, food, "2026-03")).toBe(100000);
  });

  it("ends a limit with null, from that month on", async () => {
    const food = await categoryId("Alimentação");
    await setBudget(db, food, "2026-01", 80000);

    await setBudget(db, food, "2026-04", null);

    const entries = await loadBudgets(db);
    expect(budgetFor(entries, food, "2026-03")).toBe(80000);
    expect(budgetFor(entries, food, "2026-04")).toBeNull();
  });

  it("rejects invalid input without storing anything", async () => {
    const food = await categoryId("Alimentação");
    const own = await categoryId("Transferências próprias");

    await rejectsWith(setBudget(db, food, "2026-13", 1000), "INVALID_MONTH");
    await rejectsWith(setBudget(db, food, "2026", 1000), "INVALID_MONTH");
    await rejectsWith(setBudget(db, food, "2026-01", 0), "INVALID_AMOUNT");
    await rejectsWith(setBudget(db, food, "2026-01", -500), "INVALID_AMOUNT");
    await rejectsWith(setBudget(db, food, "2026-01", 10.5), "INVALID_AMOUNT");
    await rejectsWith(setBudget(db, food, "2026-01", 100_000_001), "INVALID_AMOUNT");
    await rejectsWith(setBudget(db, "00000000-0000-7000-8000-000000000000", "2026-01", 1000), "CATEGORY_NOT_FOUND");
    await rejectsWith(setBudget(db, own, "2026-01", 1000), "CATEGORY_NOT_SPENDING");

    expect(await loadBudgets(db)).toEqual([]);
  });

  it("is enforced by the database too", async () => {
    const food = await categoryId("Alimentação");

    await expect(db.budget.create({ data: { categoryId: food, startMonth: "2026-01", amountCents: 0 } })).rejects.toThrow();
    await expect(db.budget.create({ data: { categoryId: food, startMonth: "janeiro", amountCents: 100 } })).rejects.toThrow();
    await expect(db.budget.create({ data: { categoryId: food, startMonth: "2026-00", amountCents: 100 } })).rejects.toThrow();
  });

  it("loses its limits when the category is deleted", async () => {
    const category = await createCategory(db, { name: "Temporária de orçamento" });
    createdCategories.push(category.id);
    await setBudget(db, category.id, "2026-01", 5000);

    await deleteCategory(db, category.id);

    expect(await loadBudgets(db)).toEqual([]);
  });
});

describe("budget report over the fixtures", () => {
  it("measures January against its limits", async () => {
    await importFile(db, { name: "account.ofx", bytes: fixtureBytes("account.ofx") });
    await importFile(db, { name: "card.ofx", bytes: fixtureBytes("credit-card.ofx") });
    const food = await categoryId("Alimentação");
    const subscriptions = await categoryId("Assinaturas");
    await setBudget(db, food, "2026-01", 10000);
    await setBudget(db, subscriptions, "2026-01", 10000);

    const report = budgetReport({
      rows: await loadReportRows(db, "2026-01"),
      entries: await loadBudgets(db),
      categories: await listCategories(db),
      month: "2026-01",
      currentMonth: "2026-10",
    });

    expect(report.budgeted.map((entry) => [entry.category.name, entry.spentCents, entry.status])).toEqual([
      ["Alimentação", 10320, "OVER"],
      ["Assinaturas", 3990, "ON_TRACK"],
    ]);
    expect(report.totals).toEqual({ limitCents: 20000, spentCents: 14310, remainingCents: 5690 });
    expect(report.uncategorizedCents).toBe(63190);
    expect(report.unbudgeted).toEqual([]);
    expect(report.pace).toBeNull();
  });
});

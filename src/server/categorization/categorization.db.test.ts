import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { parseNubankOfx, type ParsedStatement } from "@/lib/ofx";
import { importFile } from "../imports/import-file";
import { importStatement } from "../imports/import-statement";
import { categoryId, fixtureBytes, resetTestDb, testDb as db } from "../testing/test-db";
import { listTransactions } from "../transactions/list-transactions";
import { applyRules } from "./apply-rules";
import { listCategories } from "./list-categories";
import { setTransactionCategory } from "./set-transaction-category";

const cardStatement = parseNubankOfx(readFileSync("fixtures/nubank/credit-card.ofx", "utf8"));

/** A card statement with `count` purchases at the same merchant. */
function purchasesAt(merchant: string, count: number, idPrefix: string): ParsedStatement {
  const purchase = cardStatement.transactions[2];
  return {
    ...cardStatement,
    transactions: Array.from({ length: count }, (_, index) => ({
      ...purchase,
      externalId: `${idPrefix}-${index}`,
      description: merchant,
      merchant,
    })),
  };
}

const byDescription = async (description: string) =>
  db.transaction.findFirstOrThrow({ where: { description }, include: { category: true, merchant: true } });

beforeEach(async () => {
  await resetTestDb();
});

afterAll(() => db.$disconnect());

describe("seed data", () => {
  it("creates the categories and default rules", async () => {
    const categories = await listCategories(db);
    expect(categories).toHaveLength(14);
    expect(categories.map((category) => category.name)).toContain("Alimentação");
    expect(categories.every((category) => /^#[0-9a-f]{6}$/.test(category.color))).toBe(true);
    expect(categories.map((c) => c.name)).toEqual([...categories.map((c) => c.name)].sort((a, b) => a.localeCompare(b, "pt-BR")));
    expect(await db.categoryRule.count()).toBeGreaterThan(50);
  });

  it("can be applied again without duplicating", async () => {
    const [folder] = readdirSync("prisma/migrations").filter((name) => name.endsWith("_categorization"));
    const sql = readFileSync(`prisma/migrations/${folder}/migration.sql`, "utf8");
    const seeds = sql.split(/^-- seed:.*$/m).slice(1);
    expect(seeds).toHaveLength(2);
    const before = { categories: await db.category.count(), rules: await db.categoryRule.count() };

    for (const seed of seeds) {
      await db.$executeRawUnsafe(seed.replace(/^--.*$/gm, ""));
    }

    expect({ categories: await db.category.count(), rules: await db.categoryRule.count() }).toEqual(before);
  });
});

describe("categorization on import", () => {
  it("applies default rules to new transactions", async () => {
    await importFile(db, { name: "card.ofx", bytes: fixtureBytes("credit-card.ofx") });

    const restaurant = await byDescription("IFD *RESTAURANTE EXEMPLO");
    expect(restaurant.category?.name).toBe("Alimentação");
    expect(restaurant.categorySource).toBe("RULE");
    expect(restaurant.merchant?.categoryId).toBe(restaurant.categoryId);

    const store = await byDescription("MP *LOJAEXEMPLO - Parcela 2/10");
    expect(store.categoryId).toBeNull();
    expect(store.categorySource).toBeNull();

    const payment = await byDescription("Pagamento recebido");
    expect(payment.categoryId).toBeNull();
  });

  it("is idempotent", async () => {
    await importFile(db, { name: "card.ofx", bytes: fixtureBytes("credit-card.ofx") });
    expect(await applyRules(db)).toBe(0);
  });

  it("categorizes transactions imported before the rules existed, on any later import", async () => {
    await importStatement(db, { statement: cardStatement, fileName: "old.ofx", fileHash: "old" });
    expect((await byDescription("IFD *RESTAURANTE EXEMPLO")).categoryId).toBeNull();

    await importFile(db, { name: "account.ofx", bytes: fixtureBytes("account.ofx") });

    expect((await byDescription("IFD *RESTAURANTE EXEMPLO")).category?.name).toBe("Alimentação");
  });
});

describe("setTransactionCategory", () => {
  it("marks the transaction as manual and teaches the merchant", async () => {
    await importStatement(db, { statement: purchasesAt("LOJA DO BAIRRO", 3, "a"), fileName: "a.ofx", fileHash: "a" });
    const pets = await categoryId("Pets");
    const [target, ...others] = await db.transaction.findMany({ orderBy: { externalId: "asc" } });

    const result = await setTransactionCategory(db, target.id, pets);

    expect(result).toEqual({ merchant: "LOJA DO BAIRRO", updatedCount: 3 });
    expect(await db.transaction.findUniqueOrThrow({ where: { id: target.id } })).toMatchObject({
      categoryId: pets,
      categorySource: "MANUAL",
    });
    for (const other of others) {
      expect(await db.transaction.findUniqueOrThrow({ where: { id: other.id } })).toMatchObject({
        categoryId: pets,
        categorySource: "RULE",
      });
    }
    expect((await db.merchant.findUniqueOrThrow({ where: { name: "LOJA DO BAIRRO" } })).categoryId).toBe(pets);
  });

  it("does not touch other manual transactions of the merchant", async () => {
    await importStatement(db, { statement: purchasesAt("LOJA DO BAIRRO", 3, "a"), fileName: "a.ofx", fileHash: "a" });
    const [first, second, third] = await db.transaction.findMany({ orderBy: { externalId: "asc" } });
    const pets = await categoryId("Pets");
    const leisure = await categoryId("Lazer");

    await setTransactionCategory(db, first.id, leisure);
    const result = await setTransactionCategory(db, second.id, pets);

    expect(result.updatedCount).toBe(2);
    expect((await db.transaction.findUniqueOrThrow({ where: { id: first.id } })).categoryId).toBe(leisure);
    expect((await db.transaction.findUniqueOrThrow({ where: { id: third.id } })).categoryId).toBe(pets);
  });

  it("applies the learned category to the next import", async () => {
    await importStatement(db, { statement: purchasesAt("LOJA DO BAIRRO", 1, "a"), fileName: "a.ofx", fileHash: "a" });
    const pets = await categoryId("Pets");
    const first = await db.transaction.findFirstOrThrow();
    await setTransactionCategory(db, first.id, pets);

    await importStatement(db, { statement: purchasesAt("LOJA DO BAIRRO", 2, "b"), fileName: "b.ofx", fileHash: "b" });
    await applyRules(db);

    const added = await db.transaction.findMany({ where: { externalId: { startsWith: "b-" } } });
    expect(added).toHaveLength(2);
    expect(added.every((t) => t.categoryId === pets && t.categorySource === "RULE")).toBe(true);
  });

  it("overrides a default rule for the merchant", async () => {
    await importFile(db, { name: "card.ofx", bytes: fixtureBytes("credit-card.ofx") });
    const restaurant = await byDescription("IFD *RESTAURANTE EXEMPLO");
    const leisure = await categoryId("Lazer");

    await setTransactionCategory(db, restaurant.id, leisure);
    await applyRules(db);

    expect((await byDescription("IFD *RESTAURANTE EXEMPLO")).categoryId).toBe(leisure);
    expect((await db.merchant.findUniqueOrThrow({ where: { name: "IFD *RESTAURANTE EXEMPLO" } })).categoryId).toBe(leisure);
  });

  it("clears the category with null", async () => {
    await importStatement(db, { statement: purchasesAt("LOJA DO BAIRRO", 2, "a"), fileName: "a.ofx", fileHash: "a" });
    const [first, second] = await db.transaction.findMany({ orderBy: { externalId: "asc" } });
    await setTransactionCategory(db, first.id, await categoryId("Pets"));

    const result = await setTransactionCategory(db, first.id, null);

    expect(result.updatedCount).toBe(2);
    expect(await db.transaction.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      categoryId: null,
      categorySource: "MANUAL",
    });
    expect(await db.transaction.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({
      categoryId: null,
      categorySource: null,
    });
    expect((await db.merchant.findUniqueOrThrow({ where: { name: "LOJA DO BAIRRO" } })).categoryId).toBeNull();
  });

  it("changes only the transaction when it has no merchant", async () => {
    const statement = purchasesAt("X", 2, "a");
    statement.transactions = statement.transactions.map((t) => ({ ...t, merchant: null }));
    await importStatement(db, { statement, fileName: "a.ofx", fileHash: "a" });
    const [first, second] = await db.transaction.findMany({ orderBy: { externalId: "asc" } });

    const result = await setTransactionCategory(db, first.id, await categoryId("Outros"));

    expect(result).toEqual({ merchant: null, updatedCount: 1 });
    expect((await db.transaction.findUniqueOrThrow({ where: { id: second.id } })).categoryId).toBeNull();
  });

  it("rejects unknown transactions and categories, and internal transfers, without changing anything", async () => {
    await importFile(db, { name: "card.ofx", bytes: fixtureBytes("credit-card.ofx") });
    const purchase = await byDescription("Streaming Exemplo");
    const payment = await byDescription("Pagamento recebido");
    const unknown = "00000000-0000-7000-8000-000000000000";
    const pets = await categoryId("Pets");

    await expect(setTransactionCategory(db, unknown, pets)).rejects.toThrow();
    await expect(setTransactionCategory(db, purchase.id, unknown)).rejects.toThrow();
    await expect(setTransactionCategory(db, payment.id, pets)).rejects.toThrow();

    expect((await byDescription("Streaming Exemplo")).categoryId).toBe(purchase.categoryId);
    expect((await byDescription("Pagamento recebido")).categoryId).toBeNull();
  });
});

describe("listTransactions with categories", () => {
  it("returns the category of each row and filters by it", async () => {
    await importFile(db, { name: "card.ofx", bytes: fixtureBytes("credit-card.ofx") });
    const food = await categoryId("Alimentação");

    const all = await listTransactions(db, { month: "2026-01" });
    const restaurant = all.rows.find((row) => row.merchant === "IFD *RESTAURANTE EXEMPLO");
    expect(restaurant?.category).toMatchObject({ id: food, name: "Alimentação" });
    expect(restaurant?.category?.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(restaurant?.categorySource).toBe("RULE");

    const onlyFood = await listTransactions(db, { month: "2026-01", category: food });
    expect(onlyFood.rows.map((row) => row.merchant)).toEqual(["IFD *RESTAURANTE EXEMPLO"]);
    expect(onlyFood.totals.outCents).toBe(-5730);

    const uncategorized = await listTransactions(db, { month: "2026-01", category: "none" });
    expect(uncategorized.rows.map((row) => row.merchant).sort()).toEqual([
      "ELETRONICOSEXEMPLO*1PRODUTO",
      "MP *LOJAEXEMPLO",
    ]);
  });
});

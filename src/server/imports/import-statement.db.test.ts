import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { parseNubankOfx, type ParsedStatement, type ParsedTransaction } from "@/lib/ofx";
import { resetTestDb, testDb as db } from "../testing/test-db";
import { importStatement } from "./import-statement";

const accountStatement = parseNubankOfx(readFileSync("fixtures/nubank/account.ofx", "utf8"));
const cardStatement = parseNubankOfx(readFileSync("fixtures/nubank/credit-card.ofx", "utf8"));

const input = (statement: ParsedStatement, fileHash: string) => ({
  statement,
  fileName: `${fileHash}.ofx`,
  fileHash,
});

const withTransactions = (statement: ParsedStatement, transactions: ParsedTransaction[]) => ({
  ...statement,
  transactions,
});

const counts = async () => ({
  accounts: await db.account.count(),
  imports: await db.import.count(),
  transactions: await db.transaction.count(),
  merchants: await db.merchant.count(),
});

beforeEach(async () => {
  await resetTestDb();
});

afterAll(() => db.$disconnect());

describe("importStatement", () => {
  it("stores the account, the import, transactions and merchants", async () => {
    const result = await importStatement(db, input(accountStatement, "hash-a"));

    expect(result).toMatchObject({ alreadyImported: false, transactionCount: 5, newTransactionCount: 5 });
    expect(await counts()).toEqual({ accounts: 1, imports: 1, transactions: 5, merchants: 4 });

    const account = await db.account.findFirstOrThrow();
    expect(account).toMatchObject({ institution: "NUBANK", source: "ACCOUNT", externalId: "1234567-8" });

    const stored = await db.import.findUniqueOrThrow({ where: { id: result.importId } });
    expect(stored).toMatchObject({
      fileName: "hash-a.ofx",
      fileHash: "hash-a",
      ledgerBalanceCents: 347173,
      transactionCount: 5,
      newTransactionCount: 5,
    });
    expect(stored.periodStart.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(stored.periodEnd.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(stored.ledgerBalanceDate?.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("stores every transaction field as parsed", async () => {
    await importStatement(db, input(cardStatement, "hash-card"));

    const rows = await db.transaction.findMany({ include: { merchant: true } });
    const byExternalId = new Map(rows.map((row) => [row.externalId, row]));

    for (const parsed of cardStatement.transactions) {
      const row = byExternalId.get(parsed.externalId)!;
      expect(row.date.toISOString().slice(0, 10)).toBe(parsed.date);
      expect(row.amountCents).toBe(parsed.amountCents);
      expect(row.description).toBe(parsed.description);
      expect(row.kind).toBe(parsed.kind);
      expect(row.merchant?.name ?? null).toBe(parsed.merchant);
      expect(row.installmentNumber).toBe(parsed.installment?.number ?? null);
      expect(row.installmentTotal).toBe(parsed.installment?.total ?? null);
      expect(row.categoryId).toBeNull();
      expect(row.categorySource).toBeNull();
    }
  });

  it("does nothing when the same file is imported again", async () => {
    const first = await importStatement(db, input(accountStatement, "hash-a"));
    const before = await counts();

    const second = await importStatement(db, input(accountStatement, "hash-a"));

    expect(second).toEqual({
      importId: first.importId,
      alreadyImported: true,
      transactionCount: 5,
      newTransactionCount: 0,
    });
    expect(await counts()).toEqual(before);
  });

  it("stores only new transactions from an overlapping file", async () => {
    await importStatement(db, input(accountStatement, "hash-a"));

    const overlapping = withTransactions(accountStatement, [
      ...accountStatement.transactions.slice(0, 3),
      { ...accountStatement.transactions[3], externalId: "new-1" },
      { ...accountStatement.transactions[4], externalId: "new-2" },
    ]);
    const result = await importStatement(db, input(overlapping, "hash-b"));

    expect(result).toMatchObject({ alreadyImported: false, transactionCount: 5, newTransactionCount: 2 });
    expect(await counts()).toEqual({ accounts: 1, imports: 2, transactions: 7, merchants: 4 });
    expect(await db.transaction.count({ where: { importId: result.importId } })).toBe(2);
  });

  it("leaves existing transactions untouched on overlap", async () => {
    const first = await importStatement(db, input(accountStatement, "hash-a"));
    const category = await db.category.findUniqueOrThrow({ where: { name: "Alimentação" } });
    const target = accountStatement.transactions[1];
    await db.transaction.updateMany({
      where: { externalId: target.externalId },
      data: { categoryId: category.id, categorySource: "MANUAL" },
    });

    const changed = withTransactions(accountStatement, [
      { ...target, merchant: "OUTRO NOME", description: "changed", amountCents: -1 },
    ]);
    await importStatement(db, input(changed, "hash-b"));

    const row = await db.transaction.findFirstOrThrow({
      where: { externalId: target.externalId },
      include: { merchant: true },
    });
    expect(row).toMatchObject({
      importId: first.importId,
      categoryId: category.id,
      categorySource: "MANUAL",
      description: target.description,
      amountCents: target.amountCents,
    });
    expect(row.merchant?.name).toBe(target.merchant);
  });

  it("scopes transaction ids to the account", async () => {
    const sharedId = accountStatement.transactions[0].externalId;
    const card = withTransactions(cardStatement, [{ ...cardStatement.transactions[2], externalId: sharedId }]);

    await importStatement(db, input(accountStatement, "hash-a"));
    const result = await importStatement(db, input(card, "hash-card"));

    expect(result.newTransactionCount).toBe(1);
    expect(await db.transaction.count({ where: { externalId: sharedId } })).toBe(2);
    expect(await db.account.count()).toBe(2);
  });

  it("allows the same file hash on different accounts", async () => {
    await importStatement(db, input(accountStatement, "same-hash"));
    const result = await importStatement(db, input(cardStatement, "same-hash"));

    expect(result.alreadyImported).toBe(false);
    expect(await db.import.count()).toBe(2);
  });

  it("reuses one merchant row for repeated merchants", async () => {
    const [purchase] = cardStatement.transactions.filter((t) => t.merchant === "STREAMING EXEMPLO");
    const repeated = withTransactions(cardStatement, [purchase, { ...purchase, externalId: "again" }]);

    await importStatement(db, input(repeated, "hash-card"));
    await importStatement(db, input(withTransactions(cardStatement, [{ ...purchase, externalId: "third" }]), "hash-2"));

    expect(await db.merchant.count()).toBe(1);
    const merchant = await db.merchant.findFirstOrThrow({ include: { transactions: true } });
    expect(merchant.transactions).toHaveLength(3);
  });

  it("accepts a statement without transactions", async () => {
    const result = await importStatement(db, input(withTransactions(accountStatement, []), "hash-empty"));

    expect(result).toMatchObject({ transactionCount: 0, newTransactionCount: 0 });
    expect(await counts()).toEqual({ accounts: 1, imports: 1, transactions: 0, merchants: 0 });
  });

  it("stores nothing when the import fails midway", async () => {
    const invalid = withTransactions(cardStatement, [
      cardStatement.transactions[0],
      { ...cardStatement.transactions[1], installment: { number: 5, total: 3 } },
    ]);

    await expect(importStatement(db, input(invalid, "hash-bad"))).rejects.toThrow();
    expect(await counts()).toEqual({ accounts: 0, imports: 0, transactions: 0, merchants: 0 });
  });
});

describe("installment constraint", () => {
  it.each([
    { installmentNumber: 5, installmentTotal: 3 },
    { installmentNumber: 0, installmentTotal: 3 },
    { installmentNumber: 2, installmentTotal: null },
    { installmentNumber: null, installmentTotal: 10 },
  ])("rejects %j", async (installment) => {
    const { importId } = await importStatement(db, input(withTransactions(cardStatement, []), "hash-card"));
    const account = await db.account.findFirstOrThrow();

    await expect(
      db.transaction.create({
        data: {
          accountId: account.id,
          importId,
          externalId: "check",
          date: new Date("2026-01-01T00:00:00.000Z"),
          amountCents: -100,
          description: "x",
          kind: "CARD_PURCHASE",
          ...installment,
        },
      }),
    ).rejects.toThrow();
  });
});

import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { parseNubankOfx } from "@/lib/ofx";
import { categoryId, fixtureBytes, resetTestDb, testDb as db } from "../testing/test-db";
import { listTransactions } from "../transactions/list-transactions";
import { importFile } from "./import-file";
import { importStatement } from "./import-statement";

const january = parseNubankOfx(readFileSync("fixtures/nubank/credit-card.ofx", "utf8"));
const february = parseNubankOfx(readFileSync("fixtures/nubank/credit-card-related-entries.ofx", "utf8"));

beforeEach(async () => {
  await resetTestDb();
});

afterAll(() => db.$disconnect());

describe("card lines that share a FITID", () => {
  it("stores every line of a statement with related entries", async () => {
    const result = await importFile(db, {
      name: "february.ofx",
      bytes: fixtureBytes("credit-card-related-entries.ofx"),
    });

    expect(result).toMatchObject({ status: "IMPORTED", transactionCount: 9, newTransactionCount: 9 });
    expect(await db.transaction.count()).toBe(9);
  });

  it("stores the next installments instead of taking them for duplicates", async () => {
    await importFile(db, { name: "january.ofx", bytes: fixtureBytes("credit-card.ofx") });
    const result = await importFile(db, {
      name: "february.ofx",
      bytes: fixtureBytes("credit-card-related-entries.ofx"),
    });

    expect(result.newTransactionCount).toBe(9);
    const installments = await db.transaction.findMany({
      where: { merchant: { name: "ELETRONICOSEXEMPLO*1PRODUTO" } },
      orderBy: { installmentNumber: "asc" },
      select: { installmentNumber: true, installmentTotal: true },
    });
    expect(installments.map((row) => row.installmentNumber)).toEqual([10, 11, 12]);
  });

  it("gives a refund and returned IOF the merchant and category of what they undo", async () => {
    await importFile(db, { name: "february.ofx", bytes: fixtureBytes("credit-card-related-entries.ofx") });
    const fees = await categoryId("Serviços e taxas");

    const rows = await db.transaction.findMany({ include: { merchant: true } });
    const find = (start: string) => rows.find((row) => row.description.startsWith(start))!;

    expect(find('IOF de "')).toMatchObject({ kind: "CARD_PURCHASE", categoryId: fees });
    expect(find("IOF de volta")).toMatchObject({ kind: "CARD_REFUND", categoryId: fees });
    expect(find("IOF de volta").merchantId).toBe(find('IOF de "').merchantId);
    expect(find("Estorno de").kind).toBe("CARD_REFUND");
    expect(find("Estorno de").merchantId).toBe(find("Mp *Viagemexemplo").merchantId);
  });

  it("counts refunds as less spending, not as income", async () => {
    await importFile(db, { name: "february.ofx", bytes: fixtureBytes("credit-card-related-entries.ofx") });

    const { totals } = await listTransactions(db, { month: "2026-02" });

    expect(totals).toEqual({ inCents: 0, outCents: -86417, netCents: -86417 });
  });
});

describe("importing a file again", () => {
  it("stores the lines an earlier import of the same file missed", async () => {
    const partial = { ...february, transactions: february.transactions.slice(0, 4) };
    const first = await importStatement(db, { statement: partial, fileName: "f.ofx", fileHash: "same" });
    expect(first).toMatchObject({ alreadyImported: false, newTransactionCount: 4 });

    const second = await importStatement(db, { statement: february, fileName: "f.ofx", fileHash: "same" });

    expect(second).toMatchObject({
      importId: first.importId,
      alreadyImported: false,
      transactionCount: 9,
      newTransactionCount: 5,
    });
    expect(await db.import.count()).toBe(1);
    expect(await db.transaction.count()).toBe(9);
    expect((await db.import.findFirstOrThrow()).newTransactionCount).toBe(9);

    const third = await importStatement(db, { statement: february, fileName: "f.ofx", fileHash: "same" });
    expect(third).toMatchObject({ alreadyImported: true, newTransactionCount: 0 });
  });
});

describe("migration of rows stored before the id change", () => {
  const steps = (() => {
    const [folder] = readdirSync("prisma/migrations").filter((name) => name.endsWith("_transaction_identity"));
    const sql = readFileSync(`prisma/migrations/${folder}/migration.sql`, "utf8");
    return sql
      .split(/^-- (?:step|seed):.*$/m)
      .slice(1)
      .map((step) => step.replace(/^--.*$/gm, "").trim());
  })();

  const runMigration = async () => {
    for (const step of steps) {
      await db.$executeRawUnsafe(step);
    }
  };

  async function storeLegacyRows() {
    // Stored the way the old reader did: plain FITIDs, refunds as purchases with their own merchant.
    const legacyCard = {
      ...january,
      transactions: [
        { ...january.transactions[1], externalId: "fit-installment" },
        {
          ...january.transactions[2],
          externalId: "fit-iof",
          description: 'IOF de "Loja X"',
          merchant: 'IOF DE "LOJA X"',
        },
        { ...january.transactions[2], externalId: "fit-purchase", description: "Mp *Viagem", merchant: "MP *VIAGEM" },
        {
          ...january.transactions[2],
          externalId: "fit-refund",
          amountCents: 10000,
          description: 'Estorno de "Mp  *Viagem" (Viagem Ltda)',
          merchant: 'ESTORNO DE "MP *VIAGEM" (VIAGEM LTDA)',
        },
        {
          ...january.transactions[2],
          externalId: "fit-iof-back",
          amountCents: 420,
          description: "IOF de volta de Loja X",
          merchant: "IOF DE VOLTA DE LOJA X",
        },
        { ...january.transactions[0], externalId: "fit-payment" },
      ],
    };
    await importStatement(db, { statement: legacyCard, fileName: "legacy.ofx", fileHash: "legacy" });

    const account = parseNubankOfx(readFileSync("fixtures/nubank/account.ofx", "utf8"));
    await importStatement(db, { statement: account, fileName: "account.ofx", fileHash: "account" });

    const leisure = await categoryId("Lazer");
    await db.merchant.update({ where: { name: "MP *VIAGEM" }, data: { categoryId: leisure } });
    return { leisure, accountIds: account.transactions.map((t) => t.externalId) };
  }

  const byId = async (externalId: string) =>
    db.transaction.findFirst({ where: { externalId }, include: { merchant: true } });

  it("rewrites ids, kinds and merchants of card rows and leaves the rest alone", async () => {
    const { leisure, accountIds } = await storeLegacyRows();

    await runMigration();

    expect((await byId("fit-installment#p2/10"))?.installmentNumber).toBe(2);
    expect(await byId("fit-iof#iof")).toMatchObject({ kind: "CARD_PURCHASE", merchant: { name: "IOF" } });
    expect(await byId("fit-purchase")).toMatchObject({ kind: "CARD_PURCHASE", merchant: { name: "MP *VIAGEM" } });
    expect(await byId("fit-refund#refund")).toMatchObject({
      kind: "CARD_REFUND",
      merchant: { name: "MP *VIAGEM" },
      categoryId: leisure,
      categorySource: "RULE",
    });
    expect(await byId("fit-iof-back")).toMatchObject({ kind: "CARD_REFUND", merchant: { name: "IOF" } });
    expect(await byId("fit-payment")).toMatchObject({ kind: "CARD_PAYMENT_RECEIVED" });

    const accountRows = await db.transaction.findMany({ where: { account: { source: "ACCOUNT" } } });
    expect(accountRows.map((row) => row.externalId).sort()).toEqual([...accountIds].sort());
    expect(accountRows.every((row) => row.kind !== "CARD_REFUND")).toBe(true);

    const merchantNames = (await db.merchant.findMany()).map((merchant) => merchant.name);
    expect(merchantNames.some((name) => name.startsWith("ESTORNO DE") || name.startsWith("IOF DE"))).toBe(false);
  });

  it("changes nothing when run a second time", async () => {
    await storeLegacyRows();
    await runMigration();
    const snapshot = async () =>
      JSON.stringify(
        await db.transaction.findMany({
          orderBy: { externalId: "asc" },
          select: { externalId: true, kind: true, merchantId: true, categoryId: true },
        }),
      );
    const before = await snapshot();

    await runMigration();

    expect(await snapshot()).toBe(before);
  });

  it("makes a new import of the same lines match the migrated rows", async () => {
    await importStatement(db, {
      statement: {
        ...january,
        transactions: january.transactions.map((t) => ({ ...t, externalId: t.externalId.split("#")[0] })),
      },
      fileName: "old.ofx",
      fileHash: "old",
    });
    await runMigration();

    const result = await importStatement(db, { statement: january, fileName: "new.ofx", fileHash: "new" });

    expect(result.newTransactionCount).toBe(0);
    expect(await db.transaction.count()).toBe(5);
  });
});

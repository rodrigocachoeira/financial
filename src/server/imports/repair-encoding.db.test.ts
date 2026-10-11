import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { merchantFromDescription, parseNubankOfx, type ParsedStatement } from "@/lib/ofx";
import { categoryId, resetTestDb, testDb as db } from "../testing/test-db";
import { importFile } from "./import-file";
import { importStatement } from "./import-statement";
import { repairEncoding } from "./repair-encoding";

const card = parseNubankOfx(readFileSync("fixtures/nubank/credit-card.ofx", "utf8"));

/** What the old decoder produced: UTF-8 bytes read as windows-1252. */
const misread = (text: string) => new TextDecoder("windows-1252").decode(new TextEncoder().encode(text));

/** A card statement stored the way the old reader stored it, accents misread. */
function legacyStatement(descriptions: string[], amountCents = -5000): ParsedStatement {
  const base = card.transactions[2];
  return {
    ...card,
    transactions: descriptions.map((description, index) => {
      const kind = amountCents > 0 ? "CARD_REFUND" : "CARD_PURCHASE";
      const stored = misread(description);
      return {
        ...base,
        externalId: `legacy-${index}`,
        amountCents,
        kind,
        description: stored,
        merchant: merchantFromDescription(kind, stored, null),
      };
    }),
  };
}

const descriptions = async () =>
  (await db.transaction.findMany({ orderBy: { externalId: "asc" }, include: { merchant: true } })).map((row) => [
    row.description,
    row.merchant?.name ?? null,
  ]);

beforeEach(async () => {
  await resetTestDb();
});

afterAll(() => db.$disconnect());

describe("repairEncoding", () => {
  it("restores descriptions and merchants that were misread", async () => {
    await importStatement(db, {
      statement: legacyStatement(["Ajuste a crédito", "Farmácia São José", "Loja Sem Acento"], 5000),
      fileName: "legacy.ofx",
      fileHash: "legacy",
    });
    expect((await descriptions())[0]).toEqual(["Ajuste a crÃ©dito", "AJUSTE A CRÃ©DITO"]);

    expect(await repairEncoding(db)).toBe(2);

    expect(await descriptions()).toEqual([
      ["Ajuste a crédito", "AJUSTE A CRÉDITO"],
      ["Farmácia São José", "FARMÁCIA SÃO JOSÉ"],
      ["Loja Sem Acento", "LOJA SEM ACENTO"],
    ]);
    expect((await db.merchant.findMany()).map((merchant) => merchant.name).sort()).toEqual([
      "AJUSTE A CRÉDITO",
      "FARMÁCIA SÃO JOSÉ",
      "LOJA SEM ACENTO",
    ]);
  });

  it("changes nothing when run again, and leaves correct accents alone", async () => {
    await importStatement(db, {
      statement: legacyStatement(["Pão de Açúcar"]),
      fileName: "legacy.ofx",
      fileHash: "legacy",
    });
    await repairEncoding(db);
    // A correct description that contains "Ã": it must be inspected and kept.
    await db.transaction.updateMany({ data: { description: "PÃO DE AÇÚCAR" } });

    expect(await repairEncoding(db)).toBe(0);
    expect((await descriptions())[0][0]).toBe("PÃO DE AÇÚCAR");
  });

  it("keeps the category the user gave the misnamed merchant", async () => {
    await importStatement(db, {
      statement: legacyStatement(["Padaria Pão Quente", "Padaria Pão Quente"]),
      fileName: "legacy.ofx",
      fileHash: "legacy",
    });
    const food = await categoryId("Alimentação");
    await db.merchant.updateMany({ data: { categoryId: food } });

    await repairEncoding(db);

    const merchants = await db.merchant.findMany();
    expect(merchants).toHaveLength(1);
    expect(merchants[0]).toMatchObject({ name: "PADARIA PÃO QUENTE", categoryId: food });
    expect(await db.transaction.count({ where: { merchantId: merchants[0].id } })).toBe(2);
  });

  it("merges into the correct merchant when it already exists, keeping its category", async () => {
    await importStatement(db, {
      statement: legacyStatement(["Café Central"]),
      fileName: "legacy.ofx",
      fileHash: "legacy",
    });
    const leisure = await categoryId("Lazer");
    const food = await categoryId("Alimentação");
    await db.merchant.updateMany({ data: { categoryId: leisure } });
    const correct = await db.merchant.create({ data: { name: "CAFÉ CENTRAL", categoryId: food } });

    await repairEncoding(db);

    const merchants = await db.merchant.findMany();
    expect(merchants.map((merchant) => merchant.id)).toEqual([correct.id]);
    expect(merchants[0].categoryId).toBe(food);
  });

  it("runs with every import, so sending any file repairs what is stored", async () => {
    await importStatement(db, {
      statement: legacyStatement(["Ajuste a crédito"], 5000),
      fileName: "legacy.ofx",
      fileHash: "legacy",
    });

    await importFile(db, {
      name: "account.ofx",
      bytes: new Uint8Array(readFileSync("fixtures/nubank/account.ofx")),
    });

    const repaired = await db.transaction.findFirstOrThrow({ where: { externalId: "legacy-0" } });
    expect(repaired.description).toBe("Ajuste a crédito");
  });
});

describe("importFile with a UTF-8 card statement that declares windows-1252", () => {
  it("stores the accents correctly", async () => {
    const content = readFileSync("fixtures/nubank/credit-card.ofx", "utf8").replace(
      "<MEMO>Streaming Exemplo</MEMO>",
      "<MEMO>Ajuste a crédito</MEMO>",
    );
    expect(content).toContain("CHARSET:1252");

    await importFile(db, { name: "card.ofx", bytes: new TextEncoder().encode(content) });

    const row = await db.transaction.findFirstOrThrow({
      where: { description: { startsWith: "Ajuste" } },
      include: { merchant: true },
    });
    expect(row.description).toBe("Ajuste a crédito");
    expect(row.merchant?.name).toBe("AJUSTE A CRÉDITO");
  });
});

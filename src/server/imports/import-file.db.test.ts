import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { fixtureBytes, resetTestDb, testDb as db } from "../testing/test-db";
import { importFile } from "./import-file";
import { listImports } from "./list-imports";

const text = (content: string) => new TextEncoder().encode(content);

beforeEach(async () => {
  await resetTestDb();
});

afterAll(() => db.$disconnect());

describe("importFile", () => {
  it("imports a valid account statement", async () => {
    const result = await importFile(db, { name: "account.ofx", bytes: fixtureBytes("account.ofx") });

    expect(result).toEqual({
      fileName: "account.ofx",
      status: "IMPORTED",
      source: "ACCOUNT",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      transactionCount: 5,
      newTransactionCount: 5,
    });
    expect(await db.transaction.count()).toBe(5);
  });

  it("stores the SHA-256 of the file", async () => {
    await importFile(db, { name: "account.ofx", bytes: fixtureBytes("account.ofx") });
    const stored = await db.import.findFirstOrThrow();
    expect(stored.fileHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reports a file that was already imported, even under another name", async () => {
    await importFile(db, { name: "account.ofx", bytes: fixtureBytes("account.ofx") });
    const again = await importFile(db, { name: "renamed.ofx", bytes: fixtureBytes("account.ofx") });

    expect(again).toMatchObject({
      fileName: "renamed.ofx",
      status: "ALREADY_IMPORTED",
      source: "ACCOUNT",
      transactionCount: 5,
      newTransactionCount: 0,
    });
    expect(await db.import.count()).toBe(1);
    expect(await db.transaction.count()).toBe(5);
  });

  it.each([
    ["notes.txt", text("hello")],
    ["empty.ofx", new Uint8Array()],
    ["broken.ofx", text("this is not an ofx file")],
    ["truncated.ofx", fixtureBytes("account.ofx").slice(0, 900)],
  ])("rejects %s without storing anything", async (name, bytes) => {
    const result = await importFile(db, { name, bytes });

    expect(result.status).toBe("REJECTED");
    expect(result.fileName).toBe(name);
    expect(result.reason).toBeTruthy();
    expect(await db.account.count()).toBe(0);
    expect(await db.import.count()).toBe(0);
  });

  it("never echoes transaction descriptions in the rejection reason", async () => {
    const broken = new TextDecoder()
      .decode(fixtureBytes("account.ofx"))
      .replace("<TRNAMT>-45.90</TRNAMT>", "<TRNAMT>x</TRNAMT>");
    const result = await importFile(db, { name: "bad.ofx", bytes: text(broken) });

    expect(result.status).toBe("REJECTED");
    expect(result.reason).not.toContain("PADARIA");
    expect(result.reason).not.toContain("98.765");
  });
});

describe("listImports", () => {
  it("lists imports with source and counts, newest first", async () => {
    await importFile(db, { name: "account.ofx", bytes: fixtureBytes("account.ofx") });
    await importFile(db, { name: "card.ofx", bytes: fixtureBytes("credit-card.ofx") });

    const imports = await listImports(db);

    expect(imports.map((row) => row.fileName)).toEqual(["card.ofx", "account.ofx"]);
    expect(imports[0]).toMatchObject({
      source: "CREDIT_CARD",
      periodStart: "2026-01-03",
      periodEnd: "2026-02-03",
      transactionCount: 5,
      newTransactionCount: 5,
    });
    expect(imports[0].createdAt).toBeInstanceOf(Date);
    expect(imports[1].source).toBe("ACCOUNT");
  });

  it("returns an empty list when nothing was imported", async () => {
    expect(await listImports(db)).toEqual([]);
  });
});

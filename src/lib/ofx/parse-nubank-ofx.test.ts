import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isInternalTransfer, OfxParseError, parseNubankOfx } from "./index";

const fixture = (name: string) => readFileSync(`fixtures/nubank/${name}`, "utf8");

const accountOfx = fixture("account.ofx");
const cardOfx = fixture("credit-card.ofx");

describe("parseNubankOfx: account statement", () => {
  const statement = parseNubankOfx(accountOfx);

  it("reads source, account, period and balance", () => {
    expect(statement).toMatchObject({
      source: "ACCOUNT",
      accountId: "1234567-8",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      ledgerBalanceCents: 347173,
      ledgerBalanceDate: "2026-01-31",
      netYieldCents: 1234,
    });
    expect(statement.transactions).toHaveLength(5);
  });

  it("keeps file order, ids and dates", () => {
    expect(statement.transactions.map((t) => t.externalId)).toEqual([
      "11111111-aaaa-4aaa-8aaa-000000000001",
      "11111111-aaaa-4aaa-8aaa-000000000002",
      "11111111-aaaa-4aaa-8aaa-000000000003",
      "11111111-aaaa-4aaa-8aaa-000000000004",
      "11111111-aaaa-4aaa-8aaa-000000000005",
    ]);
    expect(statement.transactions.map((t) => t.date)).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-10",
      "2026-01-12",
      "2026-01-20",
    ]);
  });

  it("converts amounts to cents", () => {
    expect(statement.transactions.map((t) => t.amountCents)).toEqual([
      500000, -4590, -125037, -3200, -20000,
    ]);
  });

  it("classifies kinds", () => {
    expect(statement.transactions.map((t) => t.kind)).toEqual([
      "PIX_RECEIVED",
      "PIX_SENT",
      "BILL_PAYMENT",
      "DEBIT_PURCHASE",
      "PIX_SENT",
    ]);
  });

  it("extracts merchants", () => {
    expect(statement.transactions.map((t) => t.merchant)).toEqual([
      "EMPRESA FICTICIA LTDA",
      "PADARIA MODELO LTDA",
      null,
      "MERCADO EXEMPLO",
      "FULANO DE TAL",
    ]);
  });

  it("keeps the original description, accents included", () => {
    expect(statement.transactions[2].description).toBe("Pagamento de fatura");
    expect(statement.transactions[1].description).toBe(
      "Transferência enviada pelo Pix - PADARIA MODELO LTDA - 98.765.432/0001-10 - PAGAMENTOS EXEMPLO - IP (0002) Agência: 1 Conta: 87654321-0",
    );
  });

  it("has no installments", () => {
    expect(statement.transactions.every((t) => t.installment === null)).toBe(true);
  });
});

describe("parseNubankOfx: credit card statement", () => {
  const statement = parseNubankOfx(cardOfx);

  it("reads source, account, period and balance", () => {
    expect(statement).toMatchObject({
      source: "CREDIT_CARD",
      accountId: "22222222-bbbb-4bbb-8bbb-000000000000",
      periodStart: "2026-01-03",
      periodEnd: "2026-02-03",
      ledgerBalanceCents: -49710,
      ledgerBalanceDate: "2026-02-10",
      netYieldCents: null,
    });
    expect(statement.transactions).toHaveLength(5);
  });

  it("reads installment purchases", () => {
    expect(statement.transactions[1]).toMatchObject({
      description: "MP *LOJAEXEMPLO - Parcela 2/10",
      kind: "CARD_PURCHASE",
      merchant: "MP *LOJAEXEMPLO",
      installment: { number: 2, total: 10 },
      amountCents: -8990,
    });
    expect(statement.transactions[4]).toMatchObject({
      merchant: "ELETRONICOSEXEMPLO*1PRODUTO",
      installment: { number: 10, total: 12 },
    });
  });

  it("reads single purchases", () => {
    expect(statement.transactions[2]).toMatchObject({
      kind: "CARD_PURCHASE",
      merchant: "STREAMING EXEMPLO",
      installment: null,
    });
  });

  it("reads the bill payment received", () => {
    expect(statement.transactions[0]).toMatchObject({
      kind: "CARD_PAYMENT_RECEIVED",
      amountCents: 125037,
      merchant: null,
      installment: null,
    });
  });
});

describe("parseNubankOfx: card entries that share a FITID", () => {
  const { transactions } = parseNubankOfx(fixture("credit-card-related-entries.ofx"));
  const byDescription = (description: string) => transactions.find((t) => t.description === description)!;

  it("gives every line its own id", () => {
    expect(transactions).toHaveLength(9);
    expect(new Set(transactions.map((t) => t.externalId)).size).toBe(9);
  });

  it("identifies a purchase and its IOF", () => {
    expect(byDescription("Software Exemplo Inc")).toMatchObject({
      externalId: "33333333-cccc-4ccc-8ccc-000000000001",
      kind: "CARD_PURCHASE",
      merchant: "SOFTWARE EXEMPLO INC",
    });
    expect(byDescription('IOF de "Software Exemplo Inc"')).toMatchObject({
      externalId: "33333333-cccc-4ccc-8ccc-000000000001#iof",
      kind: "CARD_PURCHASE",
      merchant: "IOF",
      amountCents: -420,
    });
  });

  it("treats returned IOF as a refund of IOF", () => {
    expect(byDescription("IOF de volta de Software Exemplo Inc")).toMatchObject({
      externalId: "33333333-cccc-4ccc-8ccc-000000000002",
      kind: "CARD_REFUND",
      merchant: "IOF",
      amountCents: 420,
    });
  });

  it("points a refund at the merchant of the purchase", () => {
    expect(byDescription("Mp *Viagemexemplo")).toMatchObject({
      externalId: "33333333-cccc-4ccc-8ccc-000000000003",
      kind: "CARD_PURCHASE",
      merchant: "MP *VIAGEMEXEMPLO",
    });
    expect(byDescription('Estorno de "Mp *Viagemexemplo" (Viagem Exemplo Turismo)')).toMatchObject({
      externalId: "33333333-cccc-4ccc-8ccc-000000000003#refund",
      kind: "CARD_REFUND",
      merchant: "MP *VIAGEMEXEMPLO",
      amountCents: 18930,
      installment: null,
    });
  });

  it("identifies each installment of a purchase", () => {
    expect(byDescription("ELETRONICOSEXEMPLO*1PRODUTO - Parcela 11/12").externalId).toBe(
      "22222222-bbbb-4bbb-8bbb-000000000005#p11/12",
    );
    expect(byDescription("ELETRONICOSEXEMPLO*1PRODUTO - Parcela 12/12").externalId).toBe(
      "22222222-bbbb-4bbb-8bbb-000000000005#p12/12",
    );
  });

  it("gives an installment a different id from the previous month's", () => {
    const january = parseNubankOfx(cardOfx).transactions.find((t) => t.installment?.number === 2)!;
    const february = byDescription("MP *LOJAEXEMPLO - Parcela 3/10");
    expect(january.externalId).toBe("22222222-bbbb-4bbb-8bbb-000000000002#p2/10");
    expect(february.externalId).toBe("22222222-bbbb-4bbb-8bbb-000000000002#p3/10");
    expect(february.merchant).toBe(january.merchant);
  });

  it("treats any other card credit as a refund, and never an account credit", () => {
    const credit = cardOfx.replace("<TRNAMT>-39.90</TRNAMT>", "<TRNAMT>39.90</TRNAMT>");
    expect(parseNubankOfx(credit).transactions[2]).toMatchObject({ kind: "CARD_REFUND", merchant: "STREAMING EXEMPLO" });
    expect(parseNubankOfx(accountOfx).transactions.some((t) => t.kind === "CARD_REFUND")).toBe(false);
  });

  it("is not an internal transfer", () => {
    expect(isInternalTransfer("CARD_REFUND")).toBe(false);
  });
});

describe("isInternalTransfer", () => {
  it("is true only for bill payment kinds", () => {
    expect(isInternalTransfer("BILL_PAYMENT")).toBe(true);
    expect(isInternalTransfer("CARD_PAYMENT_RECEIVED")).toBe(true);
    for (const kind of ["PIX_SENT", "PIX_RECEIVED", "DEBIT_PURCHASE", "CARD_PURCHASE", "OTHER"] as const) {
      expect(isInternalTransfer(kind)).toBe(false);
    }
  });
});

describe("parseNubankOfx: format tolerance", () => {
  it("gives the same result with CRLF line endings", () => {
    expect(parseNubankOfx(accountOfx.replace(/\n/g, "\r\n"))).toEqual(parseNubankOfx(accountOfx));
  });

  it("accepts value tags without closing tags", () => {
    const unclosed = accountOfx.replace(/<\/(?:[A-Z]+)>(?=\r?\n)/g, (tag) =>
      /^<\/(MEMO|FITID|TRNAMT|DTPOSTED|TRNTYPE|ACCTID|DTSTART|DTEND|BALAMT|DTASOF)>$/.test(tag) ? "" : tag,
    );
    expect(unclosed).not.toContain("</MEMO>");
    expect(parseNubankOfx(unclosed)).toEqual(parseNubankOfx(accountOfx));
  });

  it("decodes SGML entities in values", () => {
    const ofx = cardOfx.replace("Streaming Exemplo", "A &amp; B &lt;LOJA&gt;");
    const transaction = parseNubankOfx(ofx).transactions[2];
    expect(transaction.description).toBe("A & B <LOJA>");
    expect(transaction.merchant).toBe("A & B <LOJA>");
  });

  it("normalizes merchant whitespace and case", () => {
    const ofx = cardOfx.replace("Streaming Exemplo", "  Loja   do  Bairro ");
    expect(parseNubankOfx(ofx).transactions[2].merchant).toBe("LOJA DO BAIRRO");
  });
});

describe("parseNubankOfx: edge cases", () => {
  const withoutTag = (ofx: string, tag: string) =>
    ofx.replace(new RegExp(`<${tag}>[^\\n]*\\n`), "");

  it.each(["", "not an ofx file", "OFXHEADER:100\nDATA:OFXSGML\n"])("rejects %j", (content) => {
    expect(() => parseNubankOfx(content)).toThrow(OfxParseError);
  });

  it.each([900, 1400, accountOfx.length - 10])("rejects a file cut short at %i characters", (length) => {
    expect(() => parseNubankOfx(accountOfx.slice(0, length))).toThrow(/Incomplete file/);
  });

  it("rejects a file with neither account nor card block", () => {
    const ofx = accountOfx.replace(/<BANKMSGSRSV1>[\s\S]*<\/BANKMSGSRSV1>\n/, "");
    expect(() => parseNubankOfx(ofx)).toThrow(OfxParseError);
  });

  it.each(["FITID", "DTPOSTED", "TRNAMT"])("rejects a transaction without %s", (tag) => {
    expect(() => parseNubankOfx(withoutTag(accountOfx, tag))).toThrow(OfxParseError);
  });

  it.each([
    ["<DTPOSTED>20260105000000[-3:BRT]</DTPOSTED>", "<DTPOSTED>2026-01-05</DTPOSTED>"],
    ["<DTPOSTED>20260105000000[-3:BRT]</DTPOSTED>", "<DTPOSTED>20261305000000[-3:BRT]</DTPOSTED>"],
    ["<DTPOSTED>20260105000000[-3:BRT]</DTPOSTED>", "<DTPOSTED>20260230000000[-3:BRT]</DTPOSTED>"],
    ["<TRNAMT>5000.00</TRNAMT>", "<TRNAMT>5.000,00</TRNAMT>"],
  ])("rejects invalid value %s -> %s", (from, to) => {
    expect(() => parseNubankOfx(accountOfx.replace(from, to))).toThrow(OfxParseError);
  });

  it("keeps lines that share a FITID in an unknown way, telling them apart by date and amount", () => {
    const ofx = accountOfx.replace("000000000002", "000000000001");
    const ids = parseNubankOfx(ofx).transactions.map((t) => t.externalId);
    expect(ids.slice(0, 2)).toEqual([
      "11111111-aaaa-4aaa-8aaa-000000000001",
      "11111111-aaaa-4aaa-8aaa-000000000001#2026-01-06:-4590",
    ]);
    expect(new Set(ids).size).toBe(5);
  });

  it("tells identical lines apart by order", () => {
    const [, first] = /(<STMTTRN>[\s\S]*?<\/STMTTRN>\n)/.exec(accountOfx)!;
    const ids = parseNubankOfx(accountOfx.replace(first, first + first + first)).transactions.map((t) => t.externalId);
    expect(ids.slice(0, 3)).toEqual([
      "11111111-aaaa-4aaa-8aaa-000000000001",
      "11111111-aaaa-4aaa-8aaa-000000000001#2026-01-05:500000",
      "11111111-aaaa-4aaa-8aaa-000000000001#2026-01-05:500000#2",
    ]);
  });

  it("never puts the description in error messages", () => {
    const ofx = accountOfx.replace("<TRNAMT>-45.90</TRNAMT>", "<TRNAMT>x</TRNAMT>");
    try {
      parseNubankOfx(ofx);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(OfxParseError);
      const message = (error as Error).message;
      expect(message).toContain("TRNAMT");
      expect(message).toContain("2");
      expect(message).not.toContain("PADARIA");
      expect(message).not.toContain("98.765");
    }
  });

  it("returns an empty list when there are no transactions", () => {
    const ofx = accountOfx.replace(/<STMTTRN>[\s\S]*<\/STMTTRN>\n/, "");
    expect(parseNubankOfx(ofx).transactions).toEqual([]);
  });

  it("reads the net yield only from its own entry of the balance list", () => {
    const zero = accountOfx.replace("<VALUE>12.34</VALUE>", "<VALUE>0.00</VALUE>");
    expect(parseNubankOfx(zero).netYieldCents).toBe(0);

    const otherEntry = accountOfx.replace("<NAME>RENDIMENTO LIQUIDO</NAME>", "<NAME>OUTRO SALDO</NAME>");
    expect(parseNubankOfx(otherEntry).netYieldCents).toBeNull();

    const withoutList = accountOfx.replace(/<BALLIST>[\s\S]*<\/BALLIST>\n/, "");
    expect(parseNubankOfx(withoutList).netYieldCents).toBeNull();
  });

  it("rejects a net yield that is not an amount", () => {
    const ofx = accountOfx.replace("<VALUE>12.34</VALUE>", "<VALUE>doze</VALUE>");
    expect(() => parseNubankOfx(ofx)).toThrow(OfxParseError);
  });

  it("returns null balance when LEDGERBAL is missing", () => {
    const ofx = accountOfx.replace(/<LEDGERBAL>[\s\S]*<\/LEDGERBAL>\n/, "");
    expect(parseNubankOfx(ofx)).toMatchObject({ ledgerBalanceCents: null, ledgerBalanceDate: null });
  });

  it("handles a missing MEMO", () => {
    expect(parseNubankOfx(withoutTag(accountOfx, "MEMO")).transactions[0]).toMatchObject({
      description: "",
      kind: "OTHER",
      merchant: null,
    });
    expect(parseNubankOfx(withoutTag(cardOfx, "MEMO")).transactions[0]).toMatchObject({
      description: "",
      // The first card line is a credit; without a memo it cannot be told from a refund.
      kind: "CARD_REFUND",
      merchant: null,
    });
  });

  it("returns null merchant for a Pix description with missing parts", () => {
    const ofx = accountOfx.replace(/<MEMO>Transferência recebida pelo Pix[^<]*/, "<MEMO>Transferência recebida pelo Pix");
    expect(parseNubankOfx(ofx).transactions[0]).toMatchObject({ kind: "PIX_RECEIVED", merchant: null });
  });

  it.each(["Parcela 0/10", "Parcela 11/10", "Parcela 1/0"])("ignores invalid installment %s", (suffix) => {
    const ofx = cardOfx.replace("Parcela 2/10", suffix);
    expect(parseNubankOfx(ofx).transactions[1]).toMatchObject({
      installment: null,
      merchant: `MP *LOJAEXEMPLO - ${suffix.toUpperCase()}`,
    });
  });
});

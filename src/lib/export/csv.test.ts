import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import { transactionsCsv, type ExportRow } from "./transactions-csv";

const BOM = "﻿";

describe("toCsv", () => {
  it("uses semicolons, CRLF and a byte order mark", () => {
    expect(toCsv(["A", "B"], [["x", "y"]])).toBe(`${BOM}A;B\r\nx;y\r\n`);
  });

  it("writes numbers with a decimal comma and null as empty", () => {
    expect(toCsv(["N"], [[-45.9], [1250.37], [0], [null], [5]])).toBe(`${BOM}N\r\n-45,9\r\n1250,37\r\n0\r\n\r\n5\r\n`);
  });

  it("quotes cells with separators, quotes or line breaks", () => {
    expect(toCsv(["T"], [["a;b"], ['say "hi"'], ["two\nlines"]])).toBe(
      `${BOM}T\r\n"a;b"\r\n"say ""hi"""\r\n"two\nlines"\r\n`,
    );
  });

  it.each(["=1+1", "+55 11 9999", "-desconto", "@usuario", "\tx"])("neutralizes the formula-like text %j", (text) => {
    const [, line] = toCsv(["T"], [[text]]).split("\r\n");
    expect(line.startsWith("'") || line.startsWith(`"'`)).toBe(true);
  });

  it("leaves a negative number as a number", () => {
    expect(toCsv(["N"], [[-10]])).toContain("\r\n-10\r\n");
  });
});

describe("transactionsCsv", () => {
  const rows: ExportRow[] = [
    {
      date: "2026-01-11",
      description: "MP *LOJAEXEMPLO - Parcela 2/10",
      merchant: "MP *LOJAEXEMPLO",
      category: { name: "Compras" },
      source: "CREDIT_CARD",
      kind: "CARD_PURCHASE",
      installment: { number: 2, total: 10 },
      amountCents: -8990,
    },
    {
      date: "2026-01-10",
      description: "Pagamento de fatura",
      merchant: null,
      category: null,
      source: "ACCOUNT",
      kind: "BILL_PAYMENT",
      installment: null,
      amountCents: -125037,
    },
    {
      date: "2026-01-05",
      description: 'Estorno de "Loja; Central"',
      merchant: "LOJA; CENTRAL",
      category: null,
      source: "CREDIT_CARD",
      kind: "CARD_REFUND",
      installment: null,
      amountCents: 18930,
    },
  ];

  it("writes one line per transaction with readable columns", () => {
    expect(transactionsCsv(rows).split("\r\n")).toEqual([
      `${BOM}Data;Descrição;Estabelecimento;Categoria;Origem;Tipo;Parcela;Valor`,
      "11/01/2026;MP *LOJAEXEMPLO - Parcela 2/10;MP *LOJAEXEMPLO;Compras;Cartão;Compra no cartão;2/10;-89,9",
      "10/01/2026;Pagamento de fatura;;;Conta;Pagamento de fatura;;-1250,37",
      '05/01/2026;"Estorno de ""Loja; Central""";"LOJA; CENTRAL";;Cartão;Estorno;;189,3',
      "",
    ]);
  });

  it("writes only the header when there is nothing to export", () => {
    expect(transactionsCsv([])).toBe(`${BOM}Data;Descrição;Estabelecimento;Categoria;Origem;Tipo;Parcela;Valor\r\n`);
  });
});

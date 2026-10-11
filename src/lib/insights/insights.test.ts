import { describe, expect, it } from "vitest";
import type { TransactionKind } from "../ofx";
import type { ReportCategory, ReportRow } from "../reports/reports";
import { buildInsightsPayload } from "./payload";
import { buildInsightsPrompt } from "./prompt";

const category = (name: string, countsAsSpending = true): ReportCategory => ({
  id: name.toLowerCase(),
  name,
  color: "#000000",
  countsAsSpending,
});

const FOOD = category("Alimentação");
const SUBSCRIPTIONS = category("Assinaturas");
const PEOPLE = category("Pessoas");
const OWN = category("Transferências próprias", false);

let nextId = 0;
function row(date: string, amountCents: number, kind: TransactionKind, options: Partial<ReportRow> = {}): ReportRow {
  nextId += 1;
  return {
    date,
    amountCents,
    kind,
    merchant: null,
    category: null,
    purchaseId: `fitid-secret-${nextId}`,
    installment: null,
    ...options,
  };
}

// Names that must never leave the application.
const PIX_PERSON = "MARIA APARECIDA DA SILVA";
const PIX_COMPANY = "EMPRESA PAGADORA LTDA";
const OWN_ACCOUNT = "MINHA CONTA NO OUTRO BANCO";

const rows: ReportRow[] = [
  // Reference month: March 2026.
  row("2026-03-05", 500000, "PIX_RECEIVED", { merchant: PIX_COMPANY }),
  row("2026-03-06", -20000, "PIX_SENT", { merchant: PIX_PERSON, category: PEOPLE }),
  row("2026-03-07", -150000, "PIX_SENT", { merchant: OWN_ACCOUNT, category: OWN }),
  row("2026-03-08", -5730, "CARD_PURCHASE", { merchant: "IFD *RESTAURANTE", category: FOOD }),
  row("2026-03-09", -4270, "DEBIT_PURCHASE", { merchant: "PADARIA CENTRAL", category: FOOD }),
  row("2026-03-10", 1000, "CARD_REFUND", { merchant: "IFD *RESTAURANTE", category: FOOD }),
  row("2026-03-14", -3990, "CARD_PURCHASE", { merchant: "STREAMING", category: SUBSCRIPTIONS }),
  row("2026-03-15", -31000, "CARD_PURCHASE", { merchant: "LOJA X" }),
  row("2026-03-16", -8990, "CARD_PURCHASE", {
    merchant: "LOJA PARCELADA",
    purchaseId: "fitid-installments",
    installment: { number: 3, total: 10 },
  }),
  row("2026-03-17", -125000, "BILL_PAYMENT"),
  // Earlier months.
  row("2026-02-06", -30000, "PIX_SENT", { merchant: PIX_PERSON, category: PEOPLE }),
  row("2026-02-08", -10000, "CARD_PURCHASE", { merchant: "IFD *RESTAURANTE", category: FOOD }),
  row("2026-02-14", -3990, "CARD_PURCHASE", { merchant: "STREAMING", category: SUBSCRIPTIONS }),
  row("2026-01-14", -3990, "CARD_PURCHASE", { merchant: "STREAMING", category: SUBSCRIPTIONS }),
  // A person paid by Pix every month must not become a "recurring merchant".
  row("2026-01-06", -30000, "PIX_SENT", { merchant: PIX_PERSON, category: PEOPLE }),
];

const payload = buildInsightsPayload(rows, "2026-03");

describe("buildInsightsPayload", () => {
  it("summarizes the month like the reports do", () => {
    expect(payload.month).toBe("2026-03");
    expect(payload.summary).toEqual({
      spentCents: 72980,
      incomeCents: 500000,
      netCents: 427020,
      spendingChange: (72980 - 43990) / 43990,
    });
  });

  it("lists categories with the previous month, Pix included only as an amount", () => {
    expect(payload.categories).toEqual([
      { name: "Pessoas", spentCents: 20000, share: 20000 / 72980, previousMonthCents: 30000 },
      { name: "Alimentação", spentCents: 9000, share: 9000 / 72980, previousMonthCents: 10000 },
      { name: "Assinaturas", spentCents: 3990, share: 3990 / 72980, previousMonthCents: 3990 },
      { name: null, spentCents: 39990, share: 39990 / 72980, previousMonthCents: 0 },
    ]);
    expect(payload.uncategorizedShare).toBe(39990 / 72980);
  });

  it("names only merchants of card and debit purchases", () => {
    expect(payload.merchants).toEqual([
      { name: "LOJA X", category: null, purchases: 1, spentCents: 31000 },
      { name: "LOJA PARCELADA", category: null, purchases: 1, spentCents: 8990 },
      { name: "IFD *RESTAURANTE", category: "Alimentação", purchases: 1, spentCents: 4730 },
      { name: "PADARIA CENTRAL", category: "Alimentação", purchases: 1, spentCents: 4270 },
      { name: "STREAMING", category: "Assinaturas", purchases: 1, spentCents: 3990 },
    ]);
  });

  it("reports recurring card charges, never a person paid by Pix every month", () => {
    expect(payload.recurring).toEqual([{ name: "STREAMING", category: "Assinaturas", months: 3, monthlyCents: 3990 }]);
  });

  it("projects the open installments, listing only months with a charge", () => {
    expect(payload.installments.totalCents).toBe(7 * 8990);
    expect(payload.installments.purchases).toEqual([{ name: "LOJA PARCELADA", remaining: 7, monthlyCents: 8990 }]);
    expect(payload.installments.byMonth.map((entry) => entry.month)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });

  it("covers up to six months, from the first one with spending to the reference month", () => {
    expect(payload.evolution.map((entry) => entry.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(payload.evolution.at(-1)).toEqual({ month: "2026-03", spentCents: 72980 });
  });

  it("keeps the reference month in the evolution even without spending", () => {
    expect(buildInsightsPayload([], "2026-03").evolution).toEqual([{ month: "2026-03", spentCents: 0 }]);
  });

  it("leaves out what does not count as spending", () => {
    expect(payload.categories.map((entry) => entry.name)).not.toContain("Transferências próprias");
  });
});

describe("what leaves the application", () => {
  const prompt = buildInsightsPrompt(payload);
  const everything = `${JSON.stringify(payload)}\n${prompt}`;

  it.each([
    ["the name of a person paid by Pix", PIX_PERSON],
    ["a word of that name", "APARECIDA"],
    ["the name of a company that paid by Pix", PIX_COMPANY],
    ["the name given to an own account", OWN_ACCOUNT],
    ["purchase ids", "fitid"],
    ["the date of a transaction", "2026-03-08"],
    ["another transaction date", "08/03/2026"],
    ["category ids", '"id"'],
    ["colors", "#000000"],
  ])("does not contain %s", (_what, secret) => {
    expect(everything).not.toContain(secret);
  });

  it("has only the expected top-level fields", () => {
    expect(Object.keys(payload).sort()).toEqual([
      "categories",
      "evolution",
      "installments",
      "merchants",
      "month",
      "recurring",
      "summary",
      "uncategorizedShare",
    ]);
  });
});

describe("buildInsightsPrompt", () => {
  const prompt = buildInsightsPrompt(payload);

  it("states the task, the rules and the limits of the data", () => {
    expect(prompt).toContain("gastos de março de 2026");
    expect(prompt).toContain("de 3 a 6 dicas");
    expect(prompt).toContain("Use apenas os números abaixo");
    expect(prompt).toContain("Não recomende produtos de investimento");
    expect(prompt).toContain("sem o nome de quem recebeu");
  });

  it("writes the figures in reais with ordinary spaces", () => {
    expect(prompt).toContain("Gasto: R$ 729,80 (66% a mais que no mês anterior)");
    expect(prompt).toContain("Receita: R$ 5.000,00");
    expect(prompt).toContain("Alimentação: R$ 90,00 (12% do mês; mês anterior: R$ 100,00)");
    expect(prompt).toContain("Sem categoria: R$ 399,90");
    expect(prompt).toContain("STREAMING: R$ 39,90 por mês, há 3 meses seguidos (Assinaturas)");
    expect(prompt).toContain("LOJA PARCELADA: faltam 7 parcelas de R$ 89,90");
    expect(prompt).not.toMatch(/ /);
  });

  it("says so when there is nothing to list", () => {
    const empty = buildInsightsPrompt(buildInsightsPayload([row("2026-03-08", -1000, "PIX_SENT")], "2026-03"));
    expect(empty).toContain("sem mês anterior para comparar");
    expect(empty).toContain("Sem categoria: R$ 10,00 (100% do mês)");
    expect(empty).not.toContain("mês anterior: R$");
    expect(empty).toContain("- Nenhum.");
    expect(empty).toContain("Nenhuma identificada");
    expect(empty).toContain("## Parcelas futuras já comprometidas\n- Nenhuma.");
  });

  it("is the same text for the same data", () => {
    expect(buildInsightsPrompt(payload)).toBe(prompt);
  });
});

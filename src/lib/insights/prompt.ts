import { formatCents, formatMonth, formatPercent } from "../format";
import type { InsightsPayload } from "./payload";

const NO_CATEGORY = "Sem categoria";

// Intl separates the currency symbol with a non-breaking space; plain spaces paste more predictably.
const money = (cents: number) => formatCents(cents).replace(/ /g, " ");

function list(lines: string[], empty: string): string {
  return lines.length > 0 ? lines.map((line) => `- ${line}`).join("\n") : `- ${empty}`;
}

/**
 * The text the user pastes into a conversation with Claude: instructions followed by the month's
 * aggregates, and nothing else. It is shown to the user in full before it is copied.
 */
export function buildInsightsPrompt(payload: InsightsPayload): string {
  const month = formatMonth(payload.month);
  const { summary } = payload;

  // Without a previous month, "R$ 0,00 last month" would be a false statement about every category.
  const hasPreviousMonth = summary.spendingChange !== null;
  const change =
    summary.spendingChange === null
      ? "sem mês anterior para comparar"
      : `${formatPercent(Math.abs(summary.spendingChange))} ${summary.spendingChange >= 0 ? "a mais" : "a menos"} que no mês anterior`;

  const sections = [
    `Analise o resumo dos meus gastos de ${month}, abaixo, e me dê de 3 a 6 dicas práticas para gastar melhor.`,

    [
      "Como responder:",
      "- Comece com uma frase sobre o principal achado do mês.",
      "- Depois liste as dicas. Cada uma com um título curto, a explicação e, quando fizer sentido, a economia mensal estimada.",
      "- Use apenas os números abaixo. Toda economia estimada deve ser uma conta feita sobre eles; mostre a conta.",
      "- Seja direto e sem julgamento. Responda em português do Brasil.",
      "- Não recomende produtos de investimento, de crédito ou instituições financeiras.",
      "- Se os dados não bastarem para alguma conclusão (pouco histórico, muito gasto sem categoria), diga isso em vez de supor.",
    ].join("\n"),

    [
      "Sobre os dados:",
      "- São valores agregados, em reais, calculados pelo meu aplicativo de finanças a partir dos extratos do banco.",
      "- \"Gasto\" já desconta estornos e não inclui pagamento de fatura nem transferências entre as minhas próprias contas.",
      "- Transferências por Pix entram somadas nas categorias, sem o nome de quem recebeu.",
    ].join("\n"),

    `## Resumo de ${month}\n${list(
      [
        `Gasto: ${money(summary.spentCents)} (${change})`,
        `Receita: ${money(summary.incomeCents)}`,
        `Saldo: ${money(summary.netCents)}`,
        `Gasto ainda sem categoria: ${formatPercent(payload.uncategorizedShare)} do total`,
      ],
      "",
    )}`,

    `## Gasto por categoria\n${list(
      payload.categories.map(
        (entry) =>
          `${entry.name ?? NO_CATEGORY}: ${money(entry.spentCents)} (${formatPercent(entry.share)} do mês${
            hasPreviousMonth ? `; mês anterior: ${money(entry.previousMonthCents)}` : ""
          })`,
      ),
      "Nenhum gasto no mês.",
    )}`,

    `## Gasto total por mês\n${list(
      payload.evolution.map((entry) => `${formatMonth(entry.month)}: ${money(entry.spentCents)}`),
      "Sem histórico.",
    )}`,

    `## Maiores estabelecimentos do mês (compras no cartão e no débito)\n${list(
      payload.merchants.map(
        (entry) =>
          `${entry.name}: ${money(entry.spentCents)} em ${entry.purchases} ${entry.purchases === 1 ? "compra" : "compras"} (${entry.category ?? NO_CATEGORY})`,
      ),
      "Nenhum.",
    )}`,

    `## Cobranças recorrentes\n${list(
      payload.recurring.map(
        (entry) =>
          `${entry.name}: ${money(entry.monthlyCents)} por mês, há ${entry.months} meses seguidos (${entry.category ?? NO_CATEGORY})`,
      ),
      "Nenhuma identificada (é preciso três meses seguidos de histórico).",
    )}`,

    `## Parcelas futuras já comprometidas\n${list(
      [
        ...(payload.installments.totalCents > 0 ? [`Total: ${money(payload.installments.totalCents)}`] : []),
        ...payload.installments.byMonth.map((entry) => `${formatMonth(entry.month)}: ${money(entry.cents)}`),
        ...payload.installments.purchases.map(
          (purchase) =>
            `${purchase.name ?? "Compra parcelada"}: ${purchase.remaining === 1 ? "falta 1 parcela" : `faltam ${purchase.remaining} parcelas`} de ${money(purchase.monthlyCents)}`,
        ),
      ],
      "Nenhuma.",
    )}`,
  ];

  return sections.join("\n\n");
}

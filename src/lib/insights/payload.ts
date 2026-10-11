import type { TransactionKind } from "../ofx";
import { addMonths } from "../reports/months";
import {
  futureInstallments,
  monthlyEvolution,
  monthSummary,
  recurringSpending,
  spendingByCategory,
  spendingChange,
  topMerchants,
  type ReportRow,
} from "../reports/reports";

/**
 * Everything that may leave the application to be analyzed by an AI: aggregates of one month.
 * No transaction descriptions, dates or ids, and no names of Pix counterparties, who are people.
 * Amounts are in cents.
 */
export interface InsightsPayload {
  /** YYYY-MM */
  month: string;
  summary: {
    spentCents: number;
    incomeCents: number;
    netCents: number;
    /** Fraction against the previous month; null when there is nothing to compare with. */
    spendingChange: number | null;
  };
  /** Largest first; `name` is null for spending without a category. */
  categories: { name: string | null; spentCents: number; share: number; previousMonthCents: number }[];
  /** Oldest first, the reference month last. Starts at the first month with spending, up to six months. */
  evolution: { month: string; spentCents: number }[];
  /** Card and debit purchases only. */
  merchants: { name: string; category: string | null; purchases: number; spentCents: number }[];
  /** Card and debit purchases only. */
  recurring: { name: string; category: string | null; months: number; monthlyCents: number }[];
  installments: {
    totalCents: number;
    byMonth: { month: string; cents: number }[];
    purchases: { name: string | null; remaining: number; monthlyCents: number }[];
  };
  /** Fraction of the month's spending still without a category. */
  uncategorizedShare: number;
}

export const INSIGHTS_EVOLUTION_MONTHS = 6;
export const INSIGHTS_TOP_MERCHANTS = 10;
export const INSIGHTS_INSTALLMENT_MONTHS = 12;

/** Kinds whose merchant is a business named on a statement, not a person. */
const NAMED_MERCHANT_KINDS: TransactionKind[] = ["CARD_PURCHASE", "CARD_REFUND", "DEBIT_PURCHASE"];

/** Months before the first one with spending have no statement imported; zero there would read as "spent nothing". */
function sinceFirstSpending<T extends { spentCents: number }>(months: T[]): T[] {
  const first = months.findIndex((entry) => entry.spentCents > 0);
  return first === -1 ? months.slice(-1) : months.slice(first);
}

export function buildInsightsPayload(rows: ReportRow[], month: string): InsightsPayload {
  // The amounts of Pix transfers stay in every total; only the counterparty's name is dropped.
  const anonymous = rows.map((row) => (NAMED_MERCHANT_KINDS.includes(row.kind) ? row : { ...row, merchant: null }));

  const summary = monthSummary(anonymous, month);
  const categories = spendingByCategory(anonymous, month);
  const previous = new Map(
    spendingByCategory(anonymous, addMonths(month, -1)).map((entry) => [entry.category?.id ?? null, entry.spentCents]),
  );
  const installments = futureInstallments(anonymous, month, INSIGHTS_INSTALLMENT_MONTHS);

  return {
    month,
    summary: { ...summary, spendingChange: spendingChange(anonymous, month) },
    categories: categories.map((entry) => ({
      name: entry.category?.name ?? null,
      spentCents: entry.spentCents,
      share: entry.share,
      previousMonthCents: previous.get(entry.category?.id ?? null) ?? 0,
    })),
    evolution: sinceFirstSpending(monthlyEvolution(anonymous, month, INSIGHTS_EVOLUTION_MONTHS)),
    merchants: topMerchants(anonymous, month, INSIGHTS_TOP_MERCHANTS).map((entry) => ({
      name: entry.merchant,
      category: entry.category?.name ?? null,
      purchases: entry.transactionCount,
      spentCents: entry.spentCents,
    })),
    recurring: recurringSpending(anonymous, month).map((entry) => ({
      name: entry.merchant,
      category: entry.category?.name ?? null,
      months: entry.months,
      monthlyCents: entry.averageCents,
    })),
    installments: {
      totalCents: installments.totalCents,
      byMonth: installments.byMonth.filter((entry) => entry.cents > 0),
      purchases: installments.purchases.map((purchase) => ({
        name: purchase.merchant,
        remaining: purchase.remaining,
        monthlyCents: purchase.monthlyCents,
      })),
    },
    uncategorizedShare: categories.find((entry) => entry.category === null)?.share ?? 0,
  };
}

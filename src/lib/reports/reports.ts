import type { Installment } from "../ofx";
import { incomeCents, isReportable, spentCents, type CountedAmount } from "./amounts";
import { addMonths, monthOf, monthsEndingAt } from "./months";

export interface ReportCategory {
  id: string;
  name: string;
  /** Hex color. */
  color: string;
  countsAsSpending: boolean;
}

export interface ReportRow extends CountedAmount {
  /** YYYY-MM-DD */
  date: string;
  merchant: string | null;
  category: ReportCategory | null;
  /** FITID of the purchase: shared by its installments, IOF and refund. */
  purchaseId: string;
  installment: Installment | null;
}

const inMonth = (rows: ReportRow[], month: string) => rows.filter((row) => monthOf(row.date) === month);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(key(item));
    if (group) {
      group.push(item);
    } else {
      groups.set(key(item), [item]);
    }
  }
  return groups;
}

export interface MonthSummary {
  spentCents: number;
  incomeCents: number;
  netCents: number;
}

export function monthSummary(rows: ReportRow[], month: string): MonthSummary {
  const monthRows = inMonth(rows, month);
  const spent = sum(monthRows.map(spentCents));
  const income = sum(monthRows.map(incomeCents));
  return { spentCents: spent, incomeCents: income, netCents: income - spent };
}

/** Change of spending against the previous month, as a fraction; null when there is nothing to compare with. */
export function spendingChange(rows: ReportRow[], month: string): number | null {
  const previous = monthSummary(rows, addMonths(month, -1)).spentCents;
  if (previous <= 0) {
    return null;
  }
  return (monthSummary(rows, month).spentCents - previous) / previous;
}

export interface CategorySpending {
  /** Null for transactions without a category. */
  category: ReportCategory | null;
  spentCents: number;
  /** Fraction of the month's spending. */
  share: number;
}

const UNCATEGORIZED = "";

/** Largest first, uncategorized last. Categories whose refunds cover their purchases are left out. */
export function spendingByCategory(rows: ReportRow[], month: string): CategorySpending[] {
  const monthRows = inMonth(rows, month);
  const total = sum(monthRows.map(spentCents));

  return [...groupBy(monthRows, (row) => row.category?.id ?? UNCATEGORIZED).values()]
    .map((group) => ({ category: group[0].category, spentCents: sum(group.map(spentCents)) }))
    .filter((entry) => entry.spentCents > 0)
    .map((entry) => ({ ...entry, share: total > 0 ? entry.spentCents / total : 0 }))
    .sort(
      (a, b) =>
        Number(a.category === null) - Number(b.category === null) ||
        b.spentCents - a.spentCents ||
        (a.category?.name ?? "").localeCompare(b.category?.name ?? ""),
    );
}

export interface MonthSpending {
  /** YYYY-MM */
  month: string;
  spentCents: number;
}

/** Spending of the `months` months that end at `endMonth`, oldest first; months without data are zero. */
export function monthlyEvolution(rows: ReportRow[], endMonth: string, months: number): MonthSpending[] {
  return monthsEndingAt(endMonth, months).map((month) => ({
    month,
    spentCents: sum(inMonth(rows, month).map(spentCents)),
  }));
}

export interface MerchantSpending {
  merchant: string;
  category: ReportCategory | null;
  /** Purchases in the month; refunds are not counted here. */
  transactionCount: number;
  spentCents: number;
}

export function topMerchants(rows: ReportRow[], month: string, limit: number): MerchantSpending[] {
  const withMerchant = inMonth(rows, month).filter((row) => row.merchant !== null && isReportable(row));

  return [...groupBy(withMerchant, (row) => row.merchant!).entries()]
    .map(([merchant, group]) => ({
      merchant,
      category: group[0].category,
      transactionCount: group.filter((row) => spentCents(row) > 0).length,
      spentCents: sum(group.map(spentCents)),
    }))
    .filter((entry) => entry.spentCents > 0)
    .sort((a, b) => b.spentCents - a.spentCents || a.merchant.localeCompare(b.merchant))
    .slice(0, limit);
}

export interface RecurringSpending {
  merchant: string;
  category: ReportCategory | null;
  /** Consecutive months with a charge. */
  months: number;
  averageCents: number;
  /** Charge of the most recent month. */
  lastCents: number;
  yearlyCents: number;
}

export const RECURRING_MIN_MONTHS = 3;
const RECURRING_TOLERANCE = 0.2;
const HISTORY_MONTHS = 13;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Merchants charged in three or more months in a row, the last one being `endMonth` or the month
 * before it, with every month within 20% of the median. Installments are not recurrences.
 */
export function recurringSpending(rows: ReportRow[], endMonth: string): RecurringSpending[] {
  const candidates = rows.filter((row) => row.merchant !== null && row.installment === null && isReportable(row));
  const result: RecurringSpending[] = [];

  for (const [merchant, group] of groupBy(candidates, (row) => row.merchant!)) {
    const byMonth = groupBy(group, (row) => monthOf(row.date));
    const spentIn = (month: string) => sum((byMonth.get(month) ?? []).map(spentCents));

    const last = spentIn(endMonth) > 0 ? endMonth : addMonths(endMonth, -1);
    const run: number[] = [];
    for (let month = last; run.length < HISTORY_MONTHS && spentIn(month) > 0; month = addMonths(month, -1)) {
      run.push(spentIn(month));
    }
    if (run.length < RECURRING_MIN_MONTHS) {
      continue;
    }
    const middle = median(run);
    if (run.some((value) => Math.abs(value - middle) > middle * RECURRING_TOLERANCE)) {
      continue;
    }

    const averageCents = Math.round(sum(run) / run.length);
    const latestRow = group.reduce((latest, row) => (row.date > latest.date ? row : latest));
    result.push({
      merchant,
      category: latestRow.category,
      months: run.length,
      averageCents,
      lastCents: run[0],
      yearlyCents: averageCents * 12,
    });
  }

  return result.sort((a, b) => b.averageCents - a.averageCents || a.merchant.localeCompare(b.merchant));
}

export interface OpenPurchase {
  /** Description without the installment suffix. */
  merchant: string | null;
  /** Latest installment already charged. */
  currentNumber: number;
  total: number;
  /** Installments still to come after the reference month. */
  remaining: number;
  monthlyCents: number;
  /** Month of the last installment, YYYY-MM. */
  endMonth: string;
}

export interface FutureInstallments {
  /** One entry for each of the next months, in order. */
  byMonth: { month: string; cents: number }[];
  /** Largest remaining amount first. */
  purchases: OpenPurchase[];
  /** Everything still to be charged after the reference month, beyond the listed months too. */
  totalCents: number;
}

/**
 * Projects the installments still to be charged after `afterMonth`: one per month, same amount,
 * starting the month after the latest installment seen of each purchase.
 */
export function futureInstallments(rows: ReportRow[], afterMonth: string, months: number): FutureInstallments {
  const horizon = Array.from({ length: months }, (_, index) => addMonths(afterMonth, index + 1));
  const totals = new Map(horizon.map((month) => [month, 0]));
  const purchases: OpenPurchase[] = [];

  const installments = rows.filter((row) => row.installment !== null && row.amountCents < 0 && isReportable(row));
  for (const group of groupBy(installments, (row) => row.purchaseId).values()) {
    const latest = group.reduce((a, b) => (b.installment!.number > a.installment!.number ? b : a));
    const { number, total } = latest.installment!;
    const latestMonth = monthOf(latest.date);
    const monthlyCents = -latest.amountCents;

    let remaining = 0;
    for (let next = number + 1; next <= total; next += 1) {
      const month = addMonths(latestMonth, next - number);
      if (month <= afterMonth) {
        continue;
      }
      remaining += 1;
      if (totals.has(month)) {
        totals.set(month, totals.get(month)! + monthlyCents);
      }
    }
    if (remaining > 0) {
      purchases.push({
        merchant: latest.merchant,
        currentNumber: number,
        total,
        remaining,
        monthlyCents,
        endMonth: addMonths(latestMonth, total - number),
      });
    }
  }

  purchases.sort(
    (a, b) => b.remaining * b.monthlyCents - a.remaining * a.monthlyCents || (a.merchant ?? "").localeCompare(b.merchant ?? ""),
  );
  return {
    byMonth: horizon.map((month) => ({ month, cents: totals.get(month)! })),
    purchases,
    totalCents: sum(purchases.map((purchase) => purchase.remaining * purchase.monthlyCents)),
  };
}

/** Rounds up to a tidy axis maximum: 1, 2, 2.5 or 5 times a power of ten. */
export function niceCeiling(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value)!;
  return step * magnitude;
}

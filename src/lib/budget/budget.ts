import { incomeCents, spentCents } from "../reports/amounts";
import { addMonths, monthOf, monthsEndingAt } from "../reports/months";
import { COMPARISON_MONTHS, type ReportCategory, type ReportRow } from "../reports/reports";

/** A monthly spending limit of a category, valid from `startMonth` on. */
export interface BudgetEntry {
  categoryId: string;
  /** YYYY-MM */
  startMonth: string;
  /** Null ends the limit from that month on. */
  amountCents: number | null;
}

export type BudgetStatus = "ON_TRACK" | "ATTENTION" | "OVER";

export interface CategoryBudget {
  category: ReportCategory;
  limitCents: number;
  spentCents: number;
  /** Negative when the limit was exceeded. */
  remainingCents: number;
  /** Spent over limit, never below zero. */
  usedFraction: number;
  status: BudgetStatus;
  /** What is left spread over the remaining days; only while the month is in progress. */
  dailyRemainingCents: number | null;
  /** A limit based on the earlier months; null without history. */
  suggestedCents: number | null;
}

export interface BudgetPace {
  /** Day of the latest transaction of the month: how far the imported data goes. */
  asOf: string;
  /** Part of the month elapsed up to that day. */
  monthFraction: number;
  daysLeft: number;
}

export interface BudgetReport {
  /** YYYY-MM */
  month: string;
  /** Null when the month is over, or has no transaction yet. */
  pace: BudgetPace | null;
  /** Most used first. */
  budgeted: CategoryBudget[];
  /** Categories with spending in the month and no limit, largest first. */
  unbudgeted: { category: ReportCategory; spentCents: number; suggestedCents: number | null }[];
  /** Spending without a category: it falls under no limit. */
  uncategorizedCents: number;
  totals: { limitCents: number; spentCents: number; remainingCents: number };
  /** Sum of the limits over the average income of the earlier months; null without either. */
  plannedShareOfIncome: number | null;
}

// Ahead of the pace by this much of the limit, and at least half of it used, before asking for attention:
// a single early purchase should not raise a flag.
const ATTENTION_MARGIN = 0.15;
const ATTENTION_MIN_USED = 0.5;

/** The limit in force for the category in the month, or null. */
export function budgetFor(entries: BudgetEntry[], categoryId: string, month: string): number | null {
  const inForce = entries
    .filter((entry) => entry.categoryId === categoryId && entry.startMonth <= month)
    .reduce<BudgetEntry | null>((latest, entry) => (!latest || entry.startMonth > latest.startMonth ? entry : latest), null);
  return inForce?.amountCents ?? null;
}

/** Rounds an average up to a limit that is easy to keep in mind: steps of R$ 10 up to R$ 500, of R$ 50 above. */
export function suggestLimit(averageCents: number): number {
  const step = averageCents <= 50000 ? 1000 : 5000;
  return Math.ceil(averageCents / step) * step;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const daysIn = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
};

export interface BudgetReportInput {
  /** Report rows covering the month and the months before it. */
  rows: ReportRow[];
  entries: BudgetEntry[];
  categories: ReportCategory[];
  /** YYYY-MM */
  month: string;
  /** The calendar month right now: only that month has a pace. */
  currentMonth: string;
}

export function budgetReport({ rows, entries, categories, month, currentMonth }: BudgetReportInput): BudgetReport {
  const monthRows = rows.filter((row) => monthOf(row.date) === month);
  const spentIn = (monthOfRows: ReportRow[], categoryId: string | null) =>
    sum(monthOfRows.filter((row) => (row.category?.id ?? null) === categoryId).map(spentCents));

  // Earlier months with any spending: the ones that have statements imported.
  const earlier = monthsEndingAt(addMonths(month, -1), COMPARISON_MONTHS)
    .map((earlierMonth) => rows.filter((row) => monthOf(row.date) === earlierMonth))
    .filter((earlierRows) => sum(earlierRows.map(spentCents)) > 0);
  const suggestionFor = (categoryId: string) => {
    if (earlier.length === 0) {
      return null;
    }
    const average = Math.round(sum(earlier.map((earlierRows) => spentIn(earlierRows, categoryId))) / earlier.length);
    return average > 0 ? suggestLimit(average) : null;
  };

  const latestDate = monthRows.reduce((latest, row) => (row.date > latest ? row.date : latest), "");
  const pace: BudgetPace | null =
    month === currentMonth && latestDate !== ""
      ? {
          asOf: latestDate,
          monthFraction: Number(latestDate.slice(8, 10)) / daysIn(month),
          daysLeft: daysIn(month) - Number(latestDate.slice(8, 10)),
        }
      : null;

  const budgeted: CategoryBudget[] = [];
  const unbudgeted: BudgetReport["unbudgeted"] = [];

  for (const category of categories) {
    if (!category.countsAsSpending) {
      continue;
    }
    const spent = spentIn(monthRows, category.id);
    const limitCents = budgetFor(entries, category.id, month);
    const suggestedCents = suggestionFor(category.id);

    if (limitCents === null) {
      if (spent > 0) {
        unbudgeted.push({ category, spentCents: spent, suggestedCents });
      }
      continue;
    }

    const remainingCents = limitCents - spent;
    const usedFraction = Math.max(0, spent / limitCents);
    const ahead = pace !== null && usedFraction >= ATTENTION_MIN_USED && usedFraction > pace.monthFraction + ATTENTION_MARGIN;
    budgeted.push({
      category,
      limitCents,
      spentCents: spent,
      remainingCents,
      usedFraction,
      status: spent > limitCents ? "OVER" : ahead ? "ATTENTION" : "ON_TRACK",
      dailyRemainingCents:
        pace !== null && pace.daysLeft > 0 && remainingCents > 0 ? Math.floor(remainingCents / pace.daysLeft) : null,
      suggestedCents,
    });
  }

  budgeted.sort((a, b) => b.usedFraction - a.usedFraction || a.category.name.localeCompare(b.category.name));
  unbudgeted.sort((a, b) => b.spentCents - a.spentCents || a.category.name.localeCompare(b.category.name));

  const limitTotal = sum(budgeted.map((entry) => entry.limitCents));
  const spentTotal = sum(budgeted.map((entry) => entry.spentCents));
  const incomes = earlier.map((earlierRows) => sum(earlierRows.map(incomeCents))).filter((income) => income > 0);

  return {
    month,
    pace,
    budgeted,
    unbudgeted,
    uncategorizedCents: Math.max(0, spentIn(monthRows, null)),
    totals: { limitCents: limitTotal, spentCents: spentTotal, remainingCents: limitTotal - spentTotal },
    plannedShareOfIncome: limitTotal > 0 && incomes.length > 0 ? limitTotal / (sum(incomes) / incomes.length) : null,
  };
}

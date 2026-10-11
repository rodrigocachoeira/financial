import { addMonths, monthOf, monthsEndingAt } from "./months";

/** The net yield one account statement declares for its period. */
export interface YieldSource {
  /** YYYY-MM-DD */
  periodStart: string;
  /** YYYY-MM-DD, inclusive */
  periodEnd: string;
  netYieldCents: number;
  /** ISO timestamp of the import; breaks ties between statements of the same period. */
  importedAt: string;
}

export interface MonthYield {
  /** YYYY-MM */
  month: string;
  /** Null when no statement of that month was imported. */
  cents: number | null;
  /** Last day the figure covers, when the statement stops before the end of the month. */
  partialUntil: string | null;
}

const lastDayOf = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const day = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
};

/**
 * The account's net yield in a month. A statement states one figure for its whole period, so:
 * - only statements whose period lies inside the month count; one that spans months cannot be split;
 * - of several statements of the month, the one reaching furthest wins, and the latest import
 *   breaks a tie. Figures are never added up: a later, fuller statement replaces an earlier one.
 */
export function monthYield(sources: YieldSource[], month: string): MonthYield {
  const best = sources
    .filter((source) => monthOf(source.periodStart) === month && monthOf(source.periodEnd) === month)
    .reduce<YieldSource | null>((winner, source) => {
      if (!winner) {
        return source;
      }
      const further = source.periodEnd.localeCompare(winner.periodEnd);
      const earlierStart = winner.periodStart.localeCompare(source.periodStart);
      const later = source.importedAt.localeCompare(winner.importedAt);
      return (further || earlierStart || later) > 0 ? source : winner;
    }, null);

  if (!best) {
    return { month, cents: null, partialUntil: null };
  }
  return {
    month,
    cents: best.netYieldCents,
    partialUntil: best.periodEnd < lastDayOf(month) ? best.periodEnd : null,
  };
}

/** The yield of the `months` months that end at `endMonth`, oldest first. */
export function yieldEvolution(sources: YieldSource[], endMonth: string, months: number): MonthYield[] {
  return monthsEndingAt(endMonth, months).map((month) => monthYield(sources, month));
}

/** True when some imported statement spans more than one month, so its yield cannot be shown per month. */
export function hasMultiMonthStatement(sources: YieldSource[], endMonth: string, months: number): boolean {
  const first = addMonths(endMonth, 1 - months);
  return sources.some(
    (source) =>
      monthOf(source.periodStart) !== monthOf(source.periodEnd) &&
      monthOf(source.periodEnd) >= first &&
      monthOf(source.periodStart) <= endMonth,
  );
}

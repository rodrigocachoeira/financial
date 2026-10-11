import { monthOf, monthsEndingAt } from "./months";

/** The closing balance one account statement declares. */
export interface BalanceSource {
  /** Day the balance refers to, YYYY-MM-DD. */
  date: string;
  cents: number;
  /** ISO timestamp of the import; breaks ties between statements closing on the same day. */
  importedAt: string;
}

export interface MonthBalance {
  /** YYYY-MM */
  month: string;
  /** Null when no statement closing in that month was imported. */
  cents: number | null;
  /** Day the balance refers to; null together with `cents`. */
  date: string | null;
}

/** The account balance at the latest day of the month any statement reports. */
export function monthBalance(sources: BalanceSource[], month: string): MonthBalance {
  const latest = sources
    .filter((source) => monthOf(source.date) === month)
    .reduce<BalanceSource | null>((winner, source) => {
      if (!winner) {
        return source;
      }
      const order = source.date.localeCompare(winner.date) || source.importedAt.localeCompare(winner.importedAt);
      return order > 0 ? source : winner;
    }, null);

  return { month, cents: latest?.cents ?? null, date: latest?.date ?? null };
}

/** The balance of the `months` months that end at `endMonth`, oldest first. */
export function balanceEvolution(sources: BalanceSource[], endMonth: string, months: number): MonthBalance[] {
  return monthsEndingAt(endMonth, months).map((month) => monthBalance(sources, month));
}

const LOCALE = "pt-BR";

const currency = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "BRL" });
const monthAndYear = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" });
const compactCurrency = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const percent = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 });
const shortMonth = new Intl.DateTimeFormat(LOCALE, { month: "short", timeZone: "UTC" });
const dayOfMonth = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** -4590 -> "-R$ 45,90" */
export function formatCents(cents: number): string {
  return currency.format(cents / 100);
}

/** "2026-01-05" -> "05/01/2026" */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/** "2026-01-25" -> "domingo, 25 de janeiro" */
export function formatDay(isoDate: string): string {
  return dayOfMonth.format(new Date(`${isoDate}T00:00:00.000Z`));
}

/** "2026-01" -> "janeiro de 2026" */
export function formatMonth(month: string): string {
  return monthAndYear.format(new Date(`${month}-01T00:00:00.000Z`));
}

export interface MonthRange {
  /** First day of the month, YYYY-MM-DD. */
  start: string;
  /** First day of the following month, YYYY-MM-DD. */
  endExclusive: string;
}

/** Parses "YYYY-MM"; null when missing or invalid. */
export function parseMonth(value: string | undefined): MonthRange | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return null;
  }
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const firstDay = (y: number, m: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
  return { start: firstDay(year, month), endExclusive: firstDay(next.year, next.month) };
}

/** 250000 -> "R$ 2,5 mil". For axis ticks, where the full amount does not fit. */
export function formatCompactCents(cents: number): string {
  return compactCurrency.format(cents / 100);
}

/** 0.124 -> "12%" */
export function formatPercent(fraction: number): string {
  return percent.format(fraction);
}

/** "2026-01" -> "jan" */
export function formatShortMonth(month: string): string {
  return shortMonth.format(new Date(`${month}-01T00:00:00.000Z`)).replace(".", "");
}

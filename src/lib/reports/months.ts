/** "2026-01-05" -> "2026-01" */
export const monthOf = (isoDate: string) => isoDate.slice(0, 7);

/** addMonths("2026-11", 3) -> "2027-02"; negative counts go back. */
export function addMonths(month: string, count: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const index = year * 12 + (monthNumber - 1) + count;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** The `count` months that end at `endMonth`, oldest first. */
export function monthsEndingAt(endMonth: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addMonths(endMonth, index - count + 1));
}

/** The twelve months of a year ("2026"), January first. */
export const monthsOfYear = (year: string) => monthsEndingAt(year + "-12", 12);

/** addMonthsToDate("2026-01-31", 1) -> "2026-02-28": same day of another month, clamped to its last day. */
export function addMonthsToDate(isoDate: string, count: number): string {
  const month = addMonths(monthOf(isoDate), count);
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const day = Math.min(Number(isoDate.slice(8, 10)), lastDay);
  return month + "-" + String(day).padStart(2, "0");
}

/** The calendar month at `now` in a time zone, as YYYY-MM. */
export function currentMonthIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  return part("year") + "-" + part("month");
}

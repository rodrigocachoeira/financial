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

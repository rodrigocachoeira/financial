export type CsvCell = string | number | null;

const SEPARATOR = ";";
const LINE_BREAK = "\r\n";
const BYTE_ORDER_MARK = "﻿";
// A spreadsheet treats a cell that starts with one of these as a formula.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CsvCell): string {
  if (value === null) {
    return "";
  }
  if (typeof value === "number") {
    // Decimal comma, as spreadsheets set to Brazilian Portuguese expect.
    return String(value).replace(".", ",");
  }
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * CSV that Excel in Brazilian Portuguese opens directly: semicolons, decimal comma, CRLF and a
 * byte order mark so accents survive. Text that could run as a formula is neutralized.
 */
export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map((row) => row.map(cell).join(SEPARATOR));
  return BYTE_ORDER_MARK + lines.join(LINE_BREAK) + LINE_BREAK;
}

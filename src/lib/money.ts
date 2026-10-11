const DECIMAL_AMOUNT = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/** Converts a statement amount such as "-45.90" into integer cents (-4590). */
export function toCents(amount: string): number {
  const match = DECIMAL_AMOUNT.exec(amount.trim());
  if (!match) {
    throw new Error("Invalid amount format");
  }
  const [, sign, units, fraction = ""] = match;
  const cents = Number(units) * 100 + Number(fraction.padEnd(2, "0"));
  return sign && cents !== 0 ? -cents : cents;
}

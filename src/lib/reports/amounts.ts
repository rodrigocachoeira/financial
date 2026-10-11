import { isInternalTransfer, type TransactionKind } from "../ofx";

/** The part of a transaction that decides how it counts in totals. */
export interface CountedAmount {
  amountCents: number;
  kind: TransactionKind;
  /** Null when the transaction has no category. */
  category: { countsAsSpending: boolean } | null;
}

/** False for money that only changes place: bill payments and categories marked as not spending. */
export function isReportable(row: CountedAmount): boolean {
  return !isInternalTransfer(row.kind) && row.category?.countsAsSpending !== false;
}

/** What the transaction adds to spending, in cents. Refunds are negative: they give spending back. */
export function spentCents(row: CountedAmount): number {
  if (!isReportable(row)) {
    return 0;
  }
  return row.amountCents < 0 || row.kind === "CARD_REFUND" ? -row.amountCents : 0;
}

/** What the transaction adds to income, in cents. Card refunds are not income. */
export function incomeCents(row: CountedAmount): number {
  if (!isReportable(row) || row.kind === "CARD_REFUND") {
    return 0;
  }
  return row.amountCents > 0 ? row.amountCents : 0;
}

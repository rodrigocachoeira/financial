import { parseMonth } from "@/lib/format";
import { addMonths } from "@/lib/reports/months";
import type { ReportRow } from "@/lib/reports/reports";
import { toDate, toIsoDate } from "../dates";
import type { PrismaClient } from "../prisma";

/** Months of history the reports look at, the reference month included. */
export const REPORT_HISTORY_MONTHS = 13;

/**
 * Transactions the reports are computed from: everything up to the end of `month`, going back
 * `REPORT_HISTORY_MONTHS` months. Later transactions are left out, so a past month is reported
 * as it stood then. Internal transfers never count, so they are not loaded.
 */
export async function loadReportRows(db: PrismaClient, month: string): Promise<ReportRow[]> {
  const first = parseMonth(addMonths(month, 1 - REPORT_HISTORY_MONTHS));
  const last = parseMonth(month);
  if (!first || !last) {
    return [];
  }

  const transactions = await db.transaction.findMany({
    where: {
      date: { gte: toDate(first.start), lt: toDate(last.endExclusive) },
      kind: { notIn: ["BILL_PAYMENT", "CARD_PAYMENT_RECEIVED"] },
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: {
      date: true,
      amountCents: true,
      kind: true,
      externalId: true,
      installmentNumber: true,
      installmentTotal: true,
      merchant: { select: { name: true } },
      category: { select: { id: true, name: true, color: true, countsAsSpending: true } },
    },
  });

  return transactions.map((t) => ({
    date: toIsoDate(t.date),
    amountCents: t.amountCents,
    kind: t.kind,
    merchant: t.merchant?.name ?? null,
    category: t.category,
    // The reader appends "#..." to the FITID to tell the lines of one purchase apart.
    purchaseId: t.externalId.split("#")[0],
    installment:
      t.installmentNumber !== null && t.installmentTotal !== null
        ? { number: t.installmentNumber, total: t.installmentTotal }
        : null,
  }));
}

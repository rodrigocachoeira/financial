import { parseMonth } from "@/lib/format";
import { isInternalTransfer, type Installment, type Source, type TransactionKind } from "@/lib/ofx";
import { toDate, toIsoDate } from "../dates";
import type { PrismaClient } from "../prisma";

export interface TransactionFilters {
  /** YYYY-MM */
  month: string;
  source?: Source;
}

export interface TransactionRow {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  merchant: string | null;
  source: Source;
  kind: TransactionKind;
  amountCents: number;
  installment: Installment | null;
  internalTransfer: boolean;
}

export interface TransactionTotals {
  inCents: number;
  outCents: number;
  netCents: number;
}

export interface TransactionList {
  rows: TransactionRow[];
  /** Internal transfers (bill payments) are left out. */
  totals: TransactionTotals;
}

/** Transactions of one month, newest first, with the totals of what is listed. */
export async function listTransactions(db: PrismaClient, filters: TransactionFilters): Promise<TransactionList> {
  const range = parseMonth(filters.month);
  if (!range) {
    return { rows: [], totals: { inCents: 0, outCents: 0, netCents: 0 } };
  }

  const transactions = await db.transaction.findMany({
    where: {
      date: { gte: toDate(range.start), lt: toDate(range.endExclusive) },
      ...(filters.source ? { account: { source: filters.source } } : {}),
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    select: {
      id: true,
      date: true,
      description: true,
      kind: true,
      amountCents: true,
      installmentNumber: true,
      installmentTotal: true,
      merchant: { select: { name: true } },
      account: { select: { source: true } },
    },
  });

  const rows = transactions.map((t): TransactionRow => ({
    id: t.id,
    date: toIsoDate(t.date),
    description: t.description,
    merchant: t.merchant?.name ?? null,
    source: t.account.source,
    kind: t.kind,
    amountCents: t.amountCents,
    installment:
      t.installmentNumber !== null && t.installmentTotal !== null
        ? { number: t.installmentNumber, total: t.installmentTotal }
        : null,
    internalTransfer: isInternalTransfer(t.kind),
  }));

  const totals = { inCents: 0, outCents: 0, netCents: 0 };
  for (const row of rows) {
    if (row.internalTransfer) {
      continue;
    }
    if (row.amountCents > 0) {
      totals.inCents += row.amountCents;
    } else {
      totals.outCents += row.amountCents;
    }
    totals.netCents += row.amountCents;
  }

  return { rows, totals };
}

/** Months that have transactions, as YYYY-MM, newest first. */
export async function listMonths(db: PrismaClient): Promise<string[]> {
  const months = await db.$queryRaw<{ month: string }[]>`
    SELECT DISTINCT to_char("date", 'YYYY-MM') AS month FROM "transactions" ORDER BY month DESC
  `;
  return months.map((row) => row.month);
}

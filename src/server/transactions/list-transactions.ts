import { parseMonth } from "@/lib/format";
import { isInternalTransfer, type Installment, type Source, type TransactionKind } from "@/lib/ofx";
import { incomeCents, spentCents } from "@/lib/reports/amounts";
import { toDate, toIsoDate } from "../dates";
import type { PrismaClient } from "../prisma";

export interface TransactionFilters {
  /** YYYY-MM for one month, or YYYY for a whole year. */
  month: string;
  source?: Source;
  /** A category id, or "none" for transactions still waiting for a category. */
  category?: string;
}

export const UNCATEGORIZED = "none";

export interface TransactionCategory {
  id: string;
  name: string;
  /** Hex color. */
  color: string;
  countsAsSpending: boolean;
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
  category: TransactionCategory | null;
  categorySource: "RULE" | "MANUAL" | null;
}

export interface TransactionTotals {
  inCents: number;
  outCents: number;
  netCents: number;
}

export interface TransactionList {
  rows: TransactionRow[];
  /**
   * Internal transfers and categories that do not count as spending are left out.
   * Card refunds lower `outCents`; they are not income.
   */
  totals: TransactionTotals;
}

/** Transactions of one month or year, newest first, with the totals of what is listed. */
export async function listTransactions(db: PrismaClient, filters: TransactionFilters): Promise<TransactionList> {
  const range = /^\d{4}$/.test(filters.month)
    ? { start: `${filters.month}-01-01`, endExclusive: `${Number(filters.month) + 1}-01-01` }
    : parseMonth(filters.month);
  if (!range) {
    return { rows: [], totals: { inCents: 0, outCents: 0, netCents: 0 } };
  }

  const transactions = await db.transaction.findMany({
    where: {
      date: { gte: toDate(range.start), lt: toDate(range.endExclusive) },
      ...(filters.source ? { account: { source: filters.source } } : {}),
      ...(filters.category === UNCATEGORIZED
        ? { categoryId: null, kind: { notIn: ["BILL_PAYMENT", "CARD_PAYMENT_RECEIVED"] } }
        : filters.category
          ? { categoryId: filters.category }
          : {}),
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
      categorySource: true,
      merchant: { select: { name: true } },
      account: { select: { source: true } },
      category: { select: { id: true, name: true, color: true, countsAsSpending: true } },
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
    category: t.category,
    categorySource: t.categorySource,
  }));

  const totals = { inCents: 0, outCents: 0, netCents: 0 };
  for (const row of rows) {
    totals.inCents += incomeCents(row);
    totals.outCents -= spentCents(row);
  }
  totals.netCents = totals.inCents + totals.outCents;

  return { rows, totals };
}

/** Months that have transactions, as YYYY-MM, newest first. */
export async function listMonths(db: PrismaClient): Promise<string[]> {
  const months = await db.$queryRaw<{ month: string }[]>`
    SELECT DISTINCT to_char("date", 'YYYY-MM') AS month FROM "transactions" ORDER BY month DESC
  `;
  return months.map((row) => row.month);
}

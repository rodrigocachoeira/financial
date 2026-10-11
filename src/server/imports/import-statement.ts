import type { ParsedStatement } from "@/lib/ofx";
import { toDate } from "../dates";
import type { PrismaClient } from "../prisma";

export interface ImportInput {
  statement: ParsedStatement;
  fileName: string;
  /** SHA-256 of the file, hex encoded. */
  fileHash: string;
}

export interface ImportResult {
  importId: string;
  /** The same file had already been imported into this account and nothing new was stored. */
  alreadyImported: boolean;
  transactionCount: number;
  newTransactionCount: number;
}

// The only statement reader so far is the Nubank one.
const INSTITUTION = "NUBANK";

/**
 * Stores a parsed statement atomically. Transactions already known to the
 * account (same external id) are skipped and left untouched.
 */
export function importStatement(db: PrismaClient, input: ImportInput): Promise<ImportResult> {
  const { statement, fileName, fileHash } = input;
  const { transactions } = statement;

  return db.$transaction(async (tx) => {
    const accountKey = { institution: INSTITUTION, source: statement.source, externalId: statement.accountId } as const;
    const account = await tx.account.upsert({
      where: { institution_source_externalId: accountKey },
      create: accountKey,
      update: {},
    });

    const existing = await tx.import.findUnique({
      where: { accountId_fileHash: { accountId: account.id, fileHash } },
    });
    const target =
      existing ??
      (await tx.import.create({
        data: {
          accountId: account.id,
          fileName,
          fileHash,
          periodStart: toDate(statement.periodStart),
          periodEnd: toDate(statement.periodEnd),
          ledgerBalanceCents: statement.ledgerBalanceCents,
          ledgerBalanceDate: statement.ledgerBalanceDate ? toDate(statement.ledgerBalanceDate) : null,
          netYieldCents: statement.netYieldCents,
          transactionCount: transactions.length,
          newTransactionCount: 0,
        },
      }));

    // A file imported before the reader extracted the yield gets it when it is sent again.
    if (existing && existing.netYieldCents === null && statement.netYieldCents !== null) {
      await tx.import.update({ where: { id: existing.id }, data: { netYieldCents: statement.netYieldCents } });
    }

    const merchantNames = [...new Set(transactions.flatMap((t) => (t.merchant ? [t.merchant] : [])))];
    await tx.merchant.createMany({ data: merchantNames.map((name) => ({ name })), skipDuplicates: true });
    const merchants = await tx.merchant.findMany({
      where: { name: { in: merchantNames } },
      select: { id: true, name: true },
    });
    const merchantIds = new Map(merchants.map((merchant) => [merchant.name, merchant.id]));

    const { count } = await tx.transaction.createMany({
      data: transactions.map((t) => ({
        accountId: account.id,
        importId: target.id,
        externalId: t.externalId,
        date: toDate(t.date),
        amountCents: t.amountCents,
        description: t.description,
        kind: t.kind,
        merchantId: t.merchant ? merchantIds.get(t.merchant) : null,
        installmentNumber: t.installment?.number ?? null,
        installmentTotal: t.installment?.total ?? null,
      })),
      skipDuplicates: true,
    });

    // A repeated file normally adds nothing. It does when an earlier version of the reader
    // missed lines of it, and then those lines are stored now.
    if (count > 0) {
      await tx.import.update({ where: { id: target.id }, data: { newTransactionCount: { increment: count } } });
    }

    return {
      importId: target.id,
      alreadyImported: existing !== null && count === 0,
      transactionCount: transactions.length,
      newTransactionCount: count,
    };
  });
}

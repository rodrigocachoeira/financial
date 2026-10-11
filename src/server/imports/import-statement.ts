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
  /** The same file had already been imported into this account; nothing was stored. */
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
    if (existing) {
      return {
        importId: existing.id,
        alreadyImported: true,
        transactionCount: existing.transactionCount,
        newTransactionCount: 0,
      };
    }

    const created = await tx.import.create({
      data: {
        accountId: account.id,
        fileName,
        fileHash,
        periodStart: toDate(statement.periodStart),
        periodEnd: toDate(statement.periodEnd),
        ledgerBalanceCents: statement.ledgerBalanceCents,
        ledgerBalanceDate: statement.ledgerBalanceDate ? toDate(statement.ledgerBalanceDate) : null,
        transactionCount: transactions.length,
        newTransactionCount: 0,
      },
    });

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
        importId: created.id,
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

    await tx.import.update({ where: { id: created.id }, data: { newTransactionCount: count } });

    return {
      importId: created.id,
      alreadyImported: false,
      transactionCount: transactions.length,
      newTransactionCount: count,
    };
  });
}

import type { Source } from "@/lib/ofx";
import { toIsoDate } from "../dates";
import type { PrismaClient } from "../prisma";

export interface ImportRow {
  id: string;
  fileName: string;
  source: Source;
  /** YYYY-MM-DD */
  periodStart: string;
  /** YYYY-MM-DD */
  periodEnd: string;
  transactionCount: number;
  newTransactionCount: number;
  createdAt: Date;
}

/** Every import, newest first. */
export async function listImports(db: PrismaClient): Promise<ImportRow[]> {
  const imports = await db.import.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      fileName: true,
      periodStart: true,
      periodEnd: true,
      transactionCount: true,
      newTransactionCount: true,
      createdAt: true,
      account: { select: { source: true } },
    },
  });

  return imports.map(({ account, periodStart, periodEnd, ...row }) => ({
    ...row,
    source: account.source,
    periodStart: toIsoDate(periodStart),
    periodEnd: toIsoDate(periodEnd),
  }));
}

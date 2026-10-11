import type { BalanceSource } from "@/lib/reports/balance";
import { toIsoDate } from "../dates";
import type { PrismaClient } from "../prisma";

/** The closing balance stated by every imported account statement. */
export async function loadBalanceSources(db: PrismaClient): Promise<BalanceSource[]> {
  const imports = await db.import.findMany({
    where: {
      ledgerBalanceCents: { not: null },
      ledgerBalanceDate: { not: null },
      account: { source: "ACCOUNT" },
    },
    orderBy: [{ ledgerBalanceDate: "asc" }, { createdAt: "asc" }],
    select: { ledgerBalanceCents: true, ledgerBalanceDate: true, createdAt: true },
  });

  return imports.map((row) => ({
    date: toIsoDate(row.ledgerBalanceDate!),
    cents: row.ledgerBalanceCents!,
    importedAt: row.createdAt.toISOString(),
  }));
}

import type { YieldSource } from "@/lib/reports/yield";
import { toIsoDate } from "../dates";
import type { PrismaClient } from "../prisma";

/** The net yield stated by every imported account statement. There are few: one per file. */
export async function loadYieldSources(db: PrismaClient): Promise<YieldSource[]> {
  const imports = await db.import.findMany({
    where: { netYieldCents: { not: null }, account: { source: "ACCOUNT" } },
    orderBy: [{ periodStart: "asc" }, { createdAt: "asc" }],
    select: { periodStart: true, periodEnd: true, netYieldCents: true, createdAt: true },
  });

  return imports.map((row) => ({
    periodStart: toIsoDate(row.periodStart),
    periodEnd: toIsoDate(row.periodEnd),
    netYieldCents: row.netYieldCents!,
    importedAt: row.createdAt.toISOString(),
  }));
}

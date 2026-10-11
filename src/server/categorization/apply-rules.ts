import { matchRule } from "@/lib/categorization/match-rule";
import type { PrismaClient } from "../prisma";

/**
 * Brings categories up to date:
 * 1. merchants without a category get the one from the matching default rule;
 * 2. transactions that are neither manual nor internal transfers get their merchant's category.
 * Returns how many transactions changed. Running it again changes nothing.
 */
export function applyRules(db: PrismaClient): Promise<number> {
  return db.$transaction(async (tx) => {
    const [rules, merchants] = await Promise.all([
      tx.categoryRule.findMany({ select: { pattern: true, categoryId: true } }),
      tx.merchant.findMany({ where: { categoryId: null }, select: { id: true, name: true } }),
    ]);

    const merchantIdsByCategory = new Map<string, string[]>();
    for (const merchant of merchants) {
      const categoryId = matchRule(merchant.name, rules);
      if (categoryId) {
        merchantIdsByCategory.set(categoryId, [...(merchantIdsByCategory.get(categoryId) ?? []), merchant.id]);
      }
    }
    for (const [categoryId, ids] of merchantIdsByCategory) {
      await tx.merchant.updateMany({ where: { id: { in: ids } }, data: { categoryId } });
    }

    return tx.$executeRaw`
      UPDATE "transactions" AS t
      SET "category_id" = m."category_id", "category_source" = 'RULE', "updated_at" = now()
      FROM "merchants" AS m
      WHERE t."merchant_id" = m."id"
        AND m."category_id" IS NOT NULL
        AND t."category_source" IS DISTINCT FROM 'MANUAL'
        AND t."kind" NOT IN ('BILL_PAYMENT', 'CARD_PAYMENT_RECEIVED')
        AND (t."category_id" IS DISTINCT FROM m."category_id" OR t."category_source" IS NULL)
    `;
  });
}

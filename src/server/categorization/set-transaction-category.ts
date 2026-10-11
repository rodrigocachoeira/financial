import { isInternalTransfer } from "@/lib/ofx";
import type { PrismaClient } from "../prisma";

export interface SetCategoryResult {
  /** Merchant that learned the category; null when the transaction has none. */
  merchant: string | null;
  /** Transactions changed, the corrected one included. */
  updatedCount: number;
}

export class CategorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategorizationError";
  }
}

/**
 * Manual correction. The transaction becomes MANUAL with the given category (null clears it).
 * When it has a merchant, the merchant keeps the category and it is applied to the
 * merchant's other transactions that were not corrected by hand.
 */
export function setTransactionCategory(
  db: PrismaClient,
  transactionId: string,
  categoryId: string | null,
): Promise<SetCategoryResult> {
  return db.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, kind: true, merchant: { select: { id: true, name: true } } },
    });
    if (!transaction) {
      throw new CategorizationError("Transaction not found");
    }
    if (isInternalTransfer(transaction.kind)) {
      throw new CategorizationError("Internal transfers have no category");
    }
    if (categoryId && !(await tx.category.findUnique({ where: { id: categoryId }, select: { id: true } }))) {
      throw new CategorizationError("Category not found");
    }

    await tx.transaction.update({
      where: { id: transaction.id },
      data: { categoryId, categorySource: "MANUAL" },
    });

    const { merchant } = transaction;
    if (!merchant) {
      return { merchant: null, updatedCount: 1 };
    }

    await tx.merchant.update({ where: { id: merchant.id }, data: { categoryId } });
    const { count } = await tx.transaction.updateMany({
      where: {
        merchantId: merchant.id,
        id: { not: transaction.id },
        kind: { notIn: ["BILL_PAYMENT", "CARD_PAYMENT_RECEIVED"] },
        OR: [{ categorySource: null }, { categorySource: "RULE" }],
      },
      data: { categoryId, categorySource: categoryId ? "RULE" : null },
    });

    return { merchant: merchant.name, updatedCount: count + 1 };
  });
}

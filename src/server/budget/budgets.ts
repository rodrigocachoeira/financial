import type { BudgetEntry } from "@/lib/budget/budget";
import { parseMonth } from "@/lib/format";
import type { PrismaClient } from "../prisma";

export type BudgetErrorCode = "INVALID_MONTH" | "INVALID_AMOUNT" | "CATEGORY_NOT_FOUND" | "CATEGORY_NOT_SPENDING";

export class BudgetError extends Error {
  constructor(readonly code: BudgetErrorCode) {
    super(code);
    this.name = "BudgetError";
  }
}

/** R$ 1 million a month: far above any real limit, and well inside a 32-bit integer of cents. */
export const MAX_BUDGET_CENTS = 100_000_000;

/** Every limit ever set. There are few: one per category and change. */
export async function loadBudgets(db: PrismaClient): Promise<BudgetEntry[]> {
  return db.budget.findMany({
    orderBy: [{ categoryId: "asc" }, { startMonth: "asc" }],
    select: { categoryId: true, startMonth: true, amountCents: true },
  });
}

/**
 * Sets the monthly limit of a category from `startMonth` on; null removes it from that month on.
 * Earlier months keep the limit they had.
 */
export async function setBudget(
  db: PrismaClient,
  categoryId: string,
  startMonth: string,
  amountCents: number | null,
): Promise<void> {
  if (!parseMonth(startMonth)) {
    throw new BudgetError("INVALID_MONTH");
  }
  if (amountCents !== null && (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > MAX_BUDGET_CENTS)) {
    throw new BudgetError("INVALID_AMOUNT");
  }

  await db.$transaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { id: categoryId }, select: { countsAsSpending: true } });
    if (!category) {
      throw new BudgetError("CATEGORY_NOT_FOUND");
    }
    if (!category.countsAsSpending) {
      throw new BudgetError("CATEGORY_NOT_SPENDING");
    }
    await tx.budget.upsert({
      where: { categoryId_startMonth: { categoryId, startMonth } },
      create: { categoryId, startMonth, amountCents },
      update: { amountCents },
    });
  });
}

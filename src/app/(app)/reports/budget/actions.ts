"use server";

import { refresh } from "next/cache";
import { formatCents, formatMonth } from "@/lib/format";
import { isUuid } from "@/lib/uuid";
import { getSession } from "@/server/auth/session";
import { BudgetError, setBudget, type BudgetErrorCode } from "@/server/budget/budgets";
import { getDb } from "@/server/db";

export interface BudgetActionState {
  ok: boolean;
  message: string;
}

const MESSAGES: Record<BudgetErrorCode, string> = {
  INVALID_MONTH: "Mês inválido.",
  INVALID_AMOUNT: "Informe um valor maior que zero.",
  CATEGORY_NOT_FOUND: "Essa categoria não existe mais.",
  CATEGORY_NOT_SPENDING: "Categorias que não contam como gasto não têm limite.",
};

/** Sets the limit of a category from `month` on; `amountCents` null removes it from that month on. */
export async function setBudgetAction(
  categoryId: string,
  month: string,
  amountCents: number | null,
): Promise<BudgetActionState> {
  if (!(await getSession())) {
    return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  }
  if (!isUuid(categoryId) || typeof month !== "string" || (amountCents !== null && typeof amountCents !== "number")) {
    return { ok: false, message: "Pedido inválido." };
  }

  try {
    await setBudget(getDb(), categoryId, month, amountCents);
    refresh();
    return {
      ok: true,
      message:
        amountCents === null
          ? `Limite removido a partir de ${formatMonth(month)}.`
          : `Limite de ${formatCents(amountCents)} a partir de ${formatMonth(month)}.`,
    };
  } catch (error) {
    if (error instanceof BudgetError) {
      return { ok: false, message: MESSAGES[error.code] };
    }
    throw error;
  }
}

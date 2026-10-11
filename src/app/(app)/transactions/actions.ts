"use server";

import { refresh } from "next/cache";
import { isUuid } from "@/lib/uuid";
import { getSession } from "@/server/auth/session";
import { CategorizationError, setTransactionCategory } from "@/server/categorization/set-transaction-category";
import { getDb } from "@/server/db";

export interface SetCategoryState {
  ok: boolean;
  message: string;
}

/** `categoryId` is a category id, or "" to clear the category. */
export async function setCategoryAction(transactionId: string, categoryId: string): Promise<SetCategoryState> {
  if (!(await getSession())) {
    return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  }
  if (!isUuid(transactionId) || (categoryId !== "" && !isUuid(categoryId))) {
    return { ok: false, message: "Pedido inválido." };
  }

  try {
    const result = await setTransactionCategory(getDb(), transactionId, categoryId || null);
    refresh();

    if (!result.merchant) {
      return { ok: true, message: "Categoria atualizada." };
    }
    const count = `${result.updatedCount} ${result.updatedCount === 1 ? "transação" : "transações"}`;
    return {
      ok: true,
      message: categoryId
        ? `Categoria aplicada a ${count} de ${result.merchant}.`
        : `Categoria removida de ${count} de ${result.merchant}.`,
    };
  } catch (error) {
    if (error instanceof CategorizationError) {
      return { ok: false, message: "Não foi possível alterar a categoria." };
    }
    throw error;
  }
}

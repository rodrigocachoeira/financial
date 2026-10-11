"use server";

import { refresh } from "next/cache";
import { isUuid } from "@/lib/uuid";
import { getSession } from "@/server/auth/session";
import { CategoryError, findOrCreateCategory } from "@/server/categorization/manage-categories";
import {
  CategorizationError,
  setTransactionCategory,
  type SetCategoryResult,
} from "@/server/categorization/set-transaction-category";
import { getDb } from "@/server/db";

export interface SetCategoryState {
  ok: boolean;
  message: string;
}

const SESSION_EXPIRED: SetCategoryState = { ok: false, message: "Sua sessão expirou. Entre novamente." };
const INVALID: SetCategoryState = { ok: false, message: "Pedido inválido." };
const FAILED: SetCategoryState = { ok: false, message: "Não foi possível alterar a categoria." };

function describe(result: SetCategoryResult, subject: string, removed = false): string {
  if (!result.merchant) {
    return `${subject} ${removed ? "removida da" : "aplicada à"} transação.`;
  }
  const count = `${result.updatedCount} ${result.updatedCount === 1 ? "transação" : "transações"}`;
  return `${subject} ${removed ? "removida de" : "aplicada a"} ${count} de ${result.merchant}.`;
}

/** `categoryId` is a category id, or "" to clear the category. */
export async function setCategoryAction(transactionId: string, categoryId: string): Promise<SetCategoryState> {
  if (!(await getSession())) {
    return SESSION_EXPIRED;
  }
  if (!isUuid(transactionId) || (categoryId !== "" && !isUuid(categoryId))) {
    return INVALID;
  }

  try {
    const result = await setTransactionCategory(getDb(), transactionId, categoryId || null);
    refresh();
    return { ok: true, message: describe(result, "Categoria", categoryId === "") };
  } catch (error) {
    if (error instanceof CategorizationError) {
      return FAILED;
    }
    throw error;
  }
}

/** Creates the category named `name`, unless one with that name exists, and applies it to the transaction. */
export async function createCategoryForTransactionAction(transactionId: string, name: string): Promise<SetCategoryState> {
  if (!(await getSession())) {
    return SESSION_EXPIRED;
  }
  if (!isUuid(transactionId) || typeof name !== "string") {
    return INVALID;
  }

  try {
    const category = await findOrCreateCategory(getDb(), name);
    const result = await setTransactionCategory(getDb(), transactionId, category.id);
    refresh();
    return { ok: true, message: describe(result, `Categoria “${category.name}”`) };
  } catch (error) {
    if (error instanceof CategoryError) {
      return {
        ok: false,
        message: error.code === "NAME_TOO_LONG" ? "O nome da categoria é longo demais." : "Informe um nome para a categoria.",
      };
    }
    if (error instanceof CategorizationError) {
      return FAILED;
    }
    throw error;
  }
}

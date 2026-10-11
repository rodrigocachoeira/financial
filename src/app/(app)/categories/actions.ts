"use server";

import { refresh } from "next/cache";
import { isUuid } from "@/lib/uuid";
import { getSession } from "@/server/auth/session";
import {
  CategoryError,
  createCategory,
  deleteCategory,
  updateCategory,
  type CategoryErrorCode,
} from "@/server/categorization/manage-categories";
import { getDb } from "@/server/db";

export interface CategoryActionState {
  ok: boolean;
  message: string;
}

export interface CategoryForm {
  /** Absent when creating. */
  id?: string;
  name: string;
  color: string;
  countsAsSpending: boolean;
}

const MESSAGES: Record<CategoryErrorCode, string> = {
  NAME_EMPTY: "Informe um nome para a categoria.",
  NAME_TOO_LONG: "O nome pode ter até 40 caracteres.",
  NAME_TAKEN: "Já existe uma categoria com esse nome.",
  INVALID_COLOR: "Escolha uma das cores disponíveis.",
  NOT_FOUND: "Essa categoria não existe mais.",
};

const SESSION_EXPIRED: CategoryActionState = { ok: false, message: "Sua sessão expirou. Entre novamente." };
const INVALID: CategoryActionState = { ok: false, message: "Pedido inválido." };

async function run(work: () => Promise<string>): Promise<CategoryActionState> {
  try {
    const message = await work();
    refresh();
    return { ok: true, message };
  } catch (error) {
    if (error instanceof CategoryError) {
      return { ok: false, message: MESSAGES[error.code] };
    }
    throw error;
  }
}

export async function saveCategoryAction(form: CategoryForm): Promise<CategoryActionState> {
  if (!(await getSession())) {
    return SESSION_EXPIRED;
  }
  const { id, name, color, countsAsSpending } = form;
  if (
    typeof name !== "string" ||
    typeof color !== "string" ||
    typeof countsAsSpending !== "boolean" ||
    (id !== undefined && !isUuid(id))
  ) {
    return INVALID;
  }

  return run(async () => {
    if (id) {
      const category = await updateCategory(getDb(), id, { name, color, countsAsSpending });
      return `Categoria “${category.name}” atualizada.`;
    }
    const category = await createCategory(getDb(), { name, color, countsAsSpending });
    return `Categoria “${category.name}” criada.`;
  });
}

export async function deleteCategoryAction(id: string): Promise<CategoryActionState> {
  if (!(await getSession())) {
    return SESSION_EXPIRED;
  }
  if (!isUuid(id)) {
    return INVALID;
  }

  return run(async () => {
    const count = await deleteCategory(getDb(), id);
    if (count === 0) {
      return "Categoria apagada.";
    }
    return `Categoria apagada. ${count} ${count === 1 ? "transação voltou" : "transações voltaram"} para “Sem categoria”.`;
  });
}

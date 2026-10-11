"use server";

import { refresh } from "next/cache";
import { MAX_FILES } from "@/lib/imports/validate-upload";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { importFile, type ImportFileResult } from "@/server/imports/import-file";

export interface ImportState {
  error?: string;
  results?: ImportFileResult[];
}

export async function importFilesAction(_previous: ImportState, formData: FormData): Promise<ImportState> {
  if (!(await getSession())) {
    return { error: "Sua sessão expirou. Entre novamente." };
  }

  // An empty file input still submits one nameless entry.
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.name !== "");
  if (files.length === 0) {
    return { error: "Selecione ao menos um arquivo .ofx." };
  }
  if (files.length > MAX_FILES) {
    return { error: `Envie no máximo ${MAX_FILES} arquivos por vez.` };
  }

  const results: ImportFileResult[] = [];
  for (const file of files) {
    try {
      results.push(await importFile(getDb(), { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }));
    } catch (error) {
      // Log the error class only: messages from the database layer may carry row values.
      console.error("Import failed:", error instanceof Error ? error.name : "unknown error");
      results.push({ fileName: file.name, status: "REJECTED", reason: "Erro inesperado ao importar. Tente novamente." });
    }
  }

  refresh();
  return { results };
}

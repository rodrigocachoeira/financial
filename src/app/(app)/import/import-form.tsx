"use client";

import { useActionState } from "react";
import { formatDate } from "@/lib/format";
import type { ImportFileResult } from "@/server/imports/import-file";
import { SOURCE_LABELS } from "../labels";
import { importFilesAction, type ImportState } from "./actions";

const INITIAL_STATE: ImportState = {};

function describe(result: ImportFileResult): string {
  if (result.status === "REJECTED") {
    return result.reason ?? "Arquivo recusado.";
  }
  const period = `${formatDate(result.periodStart!)} a ${formatDate(result.periodEnd!)}`;
  const summary = `${SOURCE_LABELS[result.source!]}, ${period}`;
  if (result.status === "ALREADY_IMPORTED") {
    return `${summary}: já importado, nada mudou.`;
  }
  return `${summary}: ${result.transactionCount} transações no arquivo, ${result.newTransactionCount} novas.`;
}

export function ImportForm() {
  const [state, action, pending] = useActionState(importFilesAction, INITIAL_STATE);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="file"
          name="files"
          accept=".ofx"
          multiple
          required
          aria-label="Arquivos OFX"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-zinc-200 file:px-3 file:py-1 file:text-sm dark:border-zinc-700 dark:file:bg-zinc-800"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {pending ? "Importando…" : "Importar"}
        </button>
      </form>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      {state.results && (
        <ul aria-label="Resultado da importação" className="flex flex-col gap-2">
          {state.results.map((result, index) => (
            <li
              key={`${index}-${result.fileName}`}
              className={`rounded-lg border px-3 py-2 text-sm ${
                result.status === "REJECTED"
                  ? "border-red-300 dark:border-red-900"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <p className="break-all font-medium">{result.fileName}</p>
              <p className={result.status === "REJECTED" ? "text-red-600 dark:text-red-400" : "text-zinc-500"}>
                {describe(result)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

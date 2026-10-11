"use client";

import { useActionState, useState } from "react";
import { AlertIcon, CheckIcon, FileIcon, RepeatIcon, Spinner, UploadIcon } from "@/components/icons";
import { badge, buttonPrimary, card } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { ImportFileResult } from "@/server/imports/import-file";
import { SOURCE_LABELS } from "../labels";
import { importFilesAction, type ImportState } from "./actions";

const INITIAL_STATE: ImportState = {};

const STATUS = {
  IMPORTED: { label: "Importado", badge: badge.positive, icon: <CheckIcon /> },
  ALREADY_IMPORTED: { label: "Já importado", badge: badge.warning, icon: <RepeatIcon /> },
  REJECTED: { label: "Recusado", badge: badge.negative, icon: <AlertIcon /> },
};

function describe(result: ImportFileResult): string {
  if (result.status === "REJECTED") {
    return result.reason ?? "Arquivo recusado.";
  }
  const summary = `${SOURCE_LABELS[result.source!]} · ${formatDate(result.periodStart!)} a ${formatDate(result.periodEnd!)}`;
  if (result.status === "ALREADY_IMPORTED") {
    return `${summary} · nada mudou`;
  }
  return `${summary} · ${result.transactionCount} transações, ${result.newTransactionCount} novas`;
}

export function ImportForm() {
  const [state, action, pending] = useActionState(importFilesAction, INITIAL_STATE);
  // The chosen file names belong to one submission: React resets the form after the action,
  // so a new action state means the selection is gone.
  const [selection, setSelection] = useState<{ state: ImportState; names: string[] }>({ state, names: [] });
  const selected = selection.state === state ? selection.names : [];

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className={`${card} flex flex-col gap-4 p-4 sm:p-5`}>
        <div
          className={`relative flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            pending
              ? "border-border opacity-60"
              : "border-border hover:border-accent hover:bg-accent-soft/40 has-[:focus-visible]:border-accent"
          }`}
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-2xl text-accent">
            <UploadIcon />
          </span>
          <p className="text-sm font-semibold">
            {selected.length === 0
              ? "Escolha os arquivos .ofx"
              : `${selected.length} ${selected.length === 1 ? "arquivo selecionado" : "arquivos selecionados"}`}
          </p>
          <p className="text-xs text-muted">Toque para selecionar ou arraste os arquivos para cá. Até 12 por vez.</p>
          <input
            type="file"
            name="files"
            accept=".ofx"
            multiple
            disabled={pending}
            aria-label="Arquivos OFX"
            onChange={(event) => setSelection({ state, names: [...(event.target.files ?? [])].map((file) => file.name) })}
            className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </div>

        {selected.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Arquivos selecionados">
            {selected.map((name, index) => (
              <li key={`${index}-${name}`} className={`${badge.neutral} max-w-full py-1`}>
                <FileIcon className="shrink-0" />
                <span className="truncate">{name}</span>
              </li>
            ))}
          </ul>
        )}

        <button type="submit" disabled={pending || selected.length === 0} className={`${buttonPrimary} sm:self-end`}>
          {pending ? <Spinner /> : <UploadIcon />}
          {pending ? "Importando…" : "Importar"}
        </button>
      </form>

      {state.error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-negative-soft px-4 py-3 text-sm text-negative">
          <AlertIcon className="shrink-0 text-base" />
          {state.error}
        </p>
      )}

      {state.results && (
        <ul aria-label="Resultado da importação" className={`${card} divide-y divide-border overflow-hidden`}>
          {state.results.map((result, index) => {
            const status = STATUS[result.status];
            return (
              <li key={`${index}-${result.fileName}`} className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-all text-sm font-medium">{result.fileName}</p>
                  <span className={`${status.badge} shrink-0`}>
                    {status.icon}
                    {status.label}
                  </span>
                </div>
                <p className={`text-xs ${result.status === "REJECTED" ? "text-negative" : "text-muted"}`}>
                  {describe(result)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

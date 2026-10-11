import type { Metadata } from "next";
import { Suspense } from "react";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { listImports } from "@/server/imports/list-imports";
import { SOURCE_LABELS } from "../labels";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Importar | Financial" };

const sentAt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

async function ImportHistory() {
  await requireSession();
  const imports = await listImports(getDb());

  if (imports.length === 0) {
    return <p className="text-sm text-zinc-500">Nenhuma importação ainda.</p>;
  }

  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {imports.map((row) => (
        <li key={row.id} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={row.fileName}>
              {row.fileName}
            </p>
            <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-zinc-500">
              <span>{SOURCE_LABELS[row.source]}</span>
              <span>
                {formatDate(row.periodStart)} a {formatDate(row.periodEnd)}
              </span>
              <span>enviado em {sentAt.format(row.createdAt)}</span>
            </p>
          </div>
          <p className="shrink-0 text-right text-xs text-zinc-500">
            <span className="block text-sm font-semibold text-foreground">{row.newTransactionCount} novas</span>
            de {row.transactionCount}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Importar</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Envie os arquivos OFX exportados do Nubank, da conta ou do cartão. Reenviar um arquivo não duplica nada.
        </p>
        <ImportForm />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Histórico</h2>
        <Suspense fallback={<p className="text-sm text-zinc-500">Carregando…</p>}>
          <ImportHistory />
        </Suspense>
      </section>
    </div>
  );
}

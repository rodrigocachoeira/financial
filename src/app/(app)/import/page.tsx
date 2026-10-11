import type { Metadata } from "next";
import { Suspense } from "react";
import { FileIcon } from "@/components/icons";
import { badge, card, skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { Source } from "@/lib/ofx";
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

const SOURCE_BADGES: Record<Source, string> = {
  ACCOUNT: badge.neutral,
  CREDIT_CARD: badge.accent,
};

async function ImportHistory() {
  await requireSession();
  const imports = await listImports(getDb());

  if (imports.length === 0) {
    return <p className={`${card} px-4 py-8 text-center text-sm text-muted`}>Nenhuma importação ainda.</p>;
  }

  return (
    <ul className={`${card} divide-y divide-border overflow-hidden`}>
      {imports.map((row) => (
        <li key={row.id} className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-surface-muted/60 sm:px-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-muted text-base text-muted">
            <FileIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={row.fileName}>
              {row.fileName}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span className={SOURCE_BADGES[row.source]}>{SOURCE_LABELS[row.source]}</span>
              <span>
                {formatDate(row.periodStart)} a {formatDate(row.periodEnd)}
              </span>
              <span>enviado em {sentAt.format(row.createdAt)}</span>
            </p>
          </div>
          <p className="shrink-0 text-right text-xs text-muted">
            <span
              className={`block text-sm font-semibold ${row.newTransactionCount > 0 ? "text-positive" : "text-muted"}`}
            >
              +{row.newTransactionCount}
            </span>
            de {row.transactionCount}
          </p>
        </li>
      ))}
    </ul>
  );
}

function HistorySkeleton() {
  return (
    <div className={`${card} divide-y divide-border`} aria-busy="true" aria-label="Carregando histórico">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <div className={`${skeleton} size-9 rounded-full`} />
          <div className="flex flex-1 flex-col gap-2">
            <div className={`${skeleton} h-3.5 w-1/2`} />
            <div className={`${skeleton} h-3 w-1/3`} />
          </div>
          <div className={`${skeleton} h-8 w-10`} />
        </div>
      ))}
    </div>
  );
}

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Importar</h1>
          <p className="mt-1 text-sm text-muted">
            Envie os arquivos OFX exportados do Nubank, da conta ou do cartão. Reenviar um arquivo não duplica nada.
          </p>
        </div>
        <ImportForm />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Histórico</h2>
        <Suspense fallback={<HistorySkeleton />}>
          <ImportHistory />
        </Suspense>
      </section>
    </div>
  );
}

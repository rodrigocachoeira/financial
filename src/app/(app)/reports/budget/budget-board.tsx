"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { AlertIcon, CheckIcon, PencilIcon, PlusIcon, Spinner, TrashIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { badge, buttonGhost, buttonPrimary, buttonSecondary, card } from "@/components/ui";
import type { BudgetReport, BudgetStatus, CategoryBudget } from "@/lib/budget/budget";
import { formatCents, formatDate, formatPercent, parseReais } from "@/lib/format";
import type { ReportCategory } from "@/lib/reports/reports";
import { setBudgetAction } from "./actions";

interface Props {
  report: BudgetReport;
  /** "outubro de 2026" */
  monthName: string;
}

/** What the dialog is editing. */
interface Draft {
  category: ReportCategory;
  limitCents: number | null;
  suggestedCents: number | null;
}

// A meter: the fill carries the status, the track is the soft step of the same color,
// and the status is always written out beside it.
const STATUS: Record<BudgetStatus, { label: string; badge: string; fill: string; track: string }> = {
  ON_TRACK: { label: "no ritmo", badge: badge.positive, fill: "bg-accent", track: "bg-accent-soft" },
  ATTENTION: { label: "atenção", badge: badge.warning, fill: "bg-warning", track: "bg-warning-soft" },
  OVER: { label: "estourou", badge: badge.negative, fill: "bg-negative", track: "bg-negative-soft" },
};

const STATUS_ICON: Record<BudgetStatus, typeof CheckIcon> = { ON_TRACK: CheckIcon, ATTENTION: AlertIcon, OVER: AlertIcon };

/** 80000 -> "800,00": what goes in the amount field. */
const asInput = (cents: number) => formatCents(cents).replace(/[^\d.,]/g, "");

function CategoryName({ category }: { category: ReportCategory }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
      <span className="truncate">{category.name}</span>
    </span>
  );
}

function Meter({ entry, paceFraction }: { entry: CategoryBudget; paceFraction: number | null }) {
  const status = STATUS[entry.status];
  return (
    <span className={`relative block h-2.5 rounded-full ${status.track}`} aria-hidden="true">
      <span
        className={`block h-full rounded-full ${status.fill}`}
        style={{ width: `${Math.min(entry.usedFraction, 1) * 100}%` }}
      />
      {paceFraction !== null && (
        // Where spending would be if it followed the calendar exactly.
        <span
          className="absolute -top-1 h-[1.125rem] w-0.5 rounded bg-foreground/70"
          style={{ left: `${Math.min(paceFraction, 1) * 100}%` }}
        />
      )}
    </span>
  );
}

function detail(entry: CategoryBudget): string {
  if (entry.remainingCents < 0) {
    return `estourou em ${formatCents(-entry.remainingCents)}`;
  }
  const left = `restam ${formatCents(entry.remainingCents)}`;
  return entry.dailyRemainingCents === null ? left : `${left}, cerca de ${formatCents(entry.dailyRemainingCents)} por dia`;
}

function BudgetDialog(props: { draft: Draft; month: string; monthName: string; onClose: () => void }) {
  const { draft, month, monthName } = props;
  const [text, setText] = useState(
    draft.limitCents !== null ? asInput(draft.limitCents) : draft.suggestedCents !== null ? asInput(draft.suggestedCents) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function send(amountCents: number | null) {
    setError(null);
    startTransition(async () => {
      const result = await setBudgetAction(draft.category.id, month, amountCents);
      if (result.ok) {
        toast(result);
        props.onClose();
      } else {
        setError(result.message);
      }
    });
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const cents = parseReais(text);
    if (cents === null || cents <= 0) {
      setError("Informe um valor em reais, como 800 ou 1.250,50.");
      return;
    }
    send(cents);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Limite mensal
        <span className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <span className="text-muted">R$</span>
          <input
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="0,00"
            autoFocus
            autoComplete="off"
            className="w-full bg-transparent py-2.5 text-base font-normal tabular-nums outline-none"
          />
        </span>
      </label>

      {draft.suggestedCents !== null && (
        <button
          type="button"
          onClick={() => setText(asInput(draft.suggestedCents!))}
          className="self-start text-sm font-medium text-accent hover:underline"
        >
          Usar a sugestão: {formatCents(draft.suggestedCents)}
        </button>
      )}

      <p className="text-sm text-muted">
        Vale a partir de {monthName}. Os meses anteriores continuam avaliados pelo limite que tinham.
        {draft.suggestedCents !== null && " A sugestão é a média dos últimos meses, arredondada para cima."}
      </p>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-negative-soft px-3 py-2 text-sm text-negative">
          <AlertIcon className="shrink-0 text-base" />
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        {draft.limitCents !== null ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => send(null)}
            className={`${buttonGhost} text-negative hover:bg-negative-soft hover:text-negative`}
          >
            <TrashIcon />
            Remover limite
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" className={buttonSecondary} disabled={pending} onClick={props.onClose}>
            Cancelar
          </button>
          <button type="submit" className={buttonPrimary} disabled={pending}>
            {pending && <Spinner />}
            Salvar
          </button>
        </div>
      </div>
    </form>
  );
}

function Figure(props: { label: string; cents: number; tone?: string }) {
  return (
    <div className={`${card} flex min-w-0 flex-col gap-1 p-3 sm:p-4`}>
      <dt className="text-xs font-medium text-muted">{props.label}</dt>
      <dd className={`truncate text-lg font-semibold sm:text-xl ${props.tone ?? ""}`}>{formatCents(props.cents)}</dd>
    </div>
  );
}

export function BudgetBoard({ report, monthName }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const { budgeted, unbudgeted, totals, pace } = report;
  const hasLimits = budgeted.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {hasLimits && (
        <div className="flex flex-col gap-2">
          <dl className="grid grid-cols-3 gap-2 sm:gap-3">
            <Figure label="Planejado" cents={totals.limitCents} />
            <Figure label="Gasto nas categorias com limite" cents={totals.spentCents} />
            <Figure
              label={totals.remainingCents < 0 ? "Acima do planejado" : "Restante"}
              cents={Math.abs(totals.remainingCents)}
              tone={totals.remainingCents < 0 ? "text-negative" : "text-positive"}
            />
          </dl>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {pace ? (
              <span>
                Dados até {formatDate(pace.asOf).slice(0, 5)}: {formatPercent(pace.monthFraction)} do mês, faltam{" "}
                {pace.daysLeft} {pace.daysLeft === 1 ? "dia" : "dias"}. O traço na barra marca esse ritmo.
              </span>
            ) : (
              <span>Mês encerrado ou ainda sem lançamentos: mostra o resultado, sem ritmo.</span>
            )}
            {report.plannedShareOfIncome !== null && (
              <span>O planejado equivale a {formatPercent(report.plannedShareOfIncome)} da sua receita média.</span>
            )}
          </p>
        </div>
      )}

      <section className={`${card} overflow-hidden`}>
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight">Categorias com limite</h2>
          <p className="mt-0.5 text-sm text-muted">Clique em uma categoria para alterar ou remover o limite.</p>
        </div>
        {hasLimits ? (
          <ul className="divide-y divide-border">
            {budgeted.map((entry) => {
              const status = STATUS[entry.status];
              const StatusIcon = STATUS_ICON[entry.status];
              return (
                <li key={entry.category.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({ category: entry.category, limitCents: entry.limitCents, suggestedCents: entry.suggestedCents })
                    }
                    aria-label={`Editar o limite de ${entry.category.name}`}
                    className="group grid w-full grid-cols-1 gap-x-5 gap-y-2 px-4 py-3.5 text-left transition-colors hover:bg-surface-muted/60 focus-visible:bg-surface-muted/60 focus-visible:outline-none sm:grid-cols-[11rem_1fr_20rem_auto] sm:items-center sm:px-5"
                  >
                    <span className="text-sm font-medium">
                      <CategoryName category={entry.category} />
                    </span>
                    <Meter entry={entry} paceFraction={pace?.monthFraction ?? null} />
                    <span className="text-sm tabular-nums">
                      <span className="font-semibold">{formatCents(entry.spentCents)}</span>{" "}
                      <span className="text-muted">de {formatCents(entry.limitCents)}</span>
                      <span className={`block text-xs ${entry.remainingCents < 0 ? "text-negative" : "text-muted"}`}>
                        {detail(entry)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 sm:justify-end">
                      <span className={status.badge}>
                        <StatusIcon />
                        {status.label}
                      </span>
                      <PencilIcon className="text-base text-muted transition-colors group-hover:text-foreground" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted sm:px-5">
            Nenhum limite definido para {monthName}. Escolha abaixo uma categoria em que você gastou e defina quanto
            pretende gastar por mês.
          </p>
        )}
      </section>

      {unbudgeted.length > 0 && (
        <section className={`${card} overflow-hidden`}>
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold tracking-tight">Sem limite</h2>
            <p className="mt-0.5 text-sm text-muted">Categorias com gasto em {monthName} e sem limite definido.</p>
          </div>
          <ul className="divide-y divide-border">
            {unbudgeted.map((entry) => (
              <li key={entry.category.id} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3 sm:px-5">
                <span className="min-w-0 text-sm font-medium">
                  <CategoryName category={entry.category} />
                </span>
                <span className="flex items-center gap-4">
                  <span className="text-right text-sm tabular-nums">
                    <span className="font-semibold">{formatCents(entry.spentCents)}</span>
                    <span className="block text-xs text-muted">
                      {entry.suggestedCents !== null ? `sugestão: ${formatCents(entry.suggestedCents)}` : "sem histórico para sugerir"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraft({ category: entry.category, limitCents: null, suggestedCents: entry.suggestedCents })}
                    className={buttonSecondary}
                  >
                    <PlusIcon />
                    Definir limite
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.uncategorizedCents > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertIcon className="shrink-0 text-base" />
          <span>{formatCents(report.uncategorizedCents)} sem categoria não entram em nenhum limite.</span>
          <Link href={`/transactions?month=${report.month}&category=none`} className="font-semibold underline">
            Categorizar
          </Link>
        </p>
      )}

      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft ? `Limite de ${draft.category.name}` : "Limite"}
      >
        {draft && (
          <BudgetDialog
            key={draft.category.id}
            draft={draft}
            month={report.month}
            monthName={monthName}
            onClose={() => setDraft(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

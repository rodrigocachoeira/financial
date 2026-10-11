import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowDownLeftIcon, ArrowUpRightIcon, SwapIcon, UploadIcon } from "@/components/icons";
import { badge, buttonPrimary, buttonSecondary, card, skeleton } from "@/components/ui";
import { formatCents, formatDay, formatMonth, parseMonth } from "@/lib/format";
import type { Source } from "@/lib/ofx";
import { isUuid } from "@/lib/uuid";
import { requireSession } from "@/server/auth/session";
import { listCategories, type CategoryOption } from "@/server/categorization/list-categories";
import { getDb } from "@/server/db";
import {
  listMonths,
  listTransactions,
  UNCATEGORIZED,
  type TransactionRow,
} from "@/server/transactions/list-transactions";
import { SOURCE_LABELS } from "../labels";
import { CategorySelect } from "./category-select";
import { TransactionFilters } from "./transaction-filters";

export const metadata: Metadata = { title: "Transações | Financial" };

const isSource = (value: unknown): value is Source => value === "ACCOUNT" || value === "CREDIT_CARD";

const SOURCE_BADGES: Record<Source, string> = {
  ACCOUNT: badge.neutral,
  CREDIT_CARD: badge.accent,
};

function Total(props: { label: string; cents: number; tone: string; icon: ReactNode; className?: string }) {
  return (
    <div className={`${card} flex min-w-0 flex-col gap-1.5 p-3 sm:p-4 ${props.className ?? ""}`}>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <span className={`grid size-5 shrink-0 place-items-center rounded-full text-xs ${props.tone}`}>{props.icon}</span>
        {props.label}
      </dt>
      <dd className="truncate text-lg font-semibold sm:text-xl">{formatCents(props.cents)}</dd>
    </div>
  );
}

function TransactionItem({ row, categories }: { row: TransactionRow; categories: CategoryOption[] }) {
  const incoming = row.amountCents > 0;
  const refund = row.kind === "CARD_REFUND";
  const tone = row.internalTransfer
    ? { chip: "bg-surface-muted text-muted", amount: "text-muted" }
    : incoming
      ? { chip: "bg-positive-soft text-positive", amount: "text-positive" }
      : { chip: "bg-negative-soft text-negative", amount: "text-foreground" };
  const icon = row.internalTransfer ? <SwapIcon /> : incoming ? <ArrowDownLeftIcon /> : <ArrowUpRightIcon />;

  return (
    <li className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-surface-muted/60 sm:px-4">
      <span className={`grid size-9 shrink-0 place-items-center rounded-full text-base ${tone.chip}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${row.internalTransfer ? "text-muted" : ""}`} title={row.description}>
          {row.merchant ?? (row.description || "Sem descrição")}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={SOURCE_BADGES[row.source]}>{SOURCE_LABELS[row.source]}</span>
          {refund && <span className={badge.positive}>estorno</span>}
          {row.installment && (
            <span className={badge.warning}>
              parcela {row.installment.number}/{row.installment.total}
            </span>
          )}
          {row.internalTransfer ? (
            <span className={badge.neutral}>transferência interna</span>
          ) : (
            <CategorySelect transactionId={row.id} value={row.category?.id ?? ""} categories={categories} />
          )}
        </p>
      </div>
      <p className={`shrink-0 text-sm font-semibold tabular-nums ${tone.amount}`}>
        {incoming && !row.internalTransfer ? "+" : ""}
        {formatCents(row.amountCents)}
      </p>
    </li>
  );
}

function groupByDate(rows: TransactionRow[]): [date: string, rows: TransactionRow[]][] {
  const groups = new Map<string, TransactionRow[]>();
  for (const row of rows) {
    groups.set(row.date, [...(groups.get(row.date) ?? []), row]);
  }
  return [...groups];
}

function EmptyState() {
  return (
    <div className={`${card} flex flex-col items-center gap-4 px-6 py-12 text-center`}>
      <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-2xl text-accent">
        <UploadIcon />
      </span>
      <div>
        <p className="font-semibold">Nenhuma transação ainda</p>
        <p className="mt-1 text-sm text-muted">Importe um extrato do Nubank para começar.</p>
      </div>
      <Link href="/import" className={buttonPrimary}>
        Importar extrato
      </Link>
    </div>
  );
}

async function Transactions({ searchParams }: Pick<PageProps<"/transactions">, "searchParams">) {
  await requireSession();
  const params = await searchParams;
  const [months, categories] = await Promise.all([listMonths(getDb()), listCategories(getDb())]);

  if (months.length === 0) {
    return <EmptyState />;
  }

  const month = typeof params.month === "string" && parseMonth(params.month) ? params.month : months[0];
  const source = isSource(params.account) ? params.account : undefined;
  const category =
    params.category === UNCATEGORIZED || (isUuid(params.category) && categories.some((c) => c.id === params.category))
      ? params.category
      : undefined;
  const { rows, totals } = await listTransactions(getDb(), { month, source, category });
  const monthOptions = months.includes(month) ? months : [month, ...months].sort().reverse();

  return (
    <div className="flex flex-col gap-5">
      <TransactionFilters
        months={monthOptions}
        categories={categories}
        month={month}
        source={source ?? ""}
        category={category ?? ""}
      />

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <Total label="Entradas" cents={totals.inCents} tone="bg-positive-soft text-positive" icon={<ArrowDownLeftIcon />} />
        <Total label="Saídas" cents={totals.outCents} tone="bg-negative-soft text-negative" icon={<ArrowUpRightIcon />} />
        <Total
          label="Saldo"
          cents={totals.netCents}
          tone="bg-accent-soft text-accent"
          icon={<SwapIcon />}
          className="col-span-2 sm:col-span-1"
        />
      </dl>

      {rows.length === 0 ? (
        <p className={`${card} px-4 py-10 text-center text-sm text-muted`}>
          Nenhuma transação com esses filtros em {formatMonth(month)}.
        </p>
      ) : (
        <div className={`${card} overflow-hidden`}>
          {groupByDate(rows).map(([date, dayRows]) => (
            <section key={date}>
              <h2 className="border-b border-border bg-surface-muted/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted sm:px-4">
                {formatDay(date)}
              </h2>
              <ul className="divide-y divide-border border-b border-border last:border-b-0">
                {dayRows.map((row) => (
                  <TransactionItem key={row.id} row={row} categories={categories} />
                ))}
              </ul>
            </section>
          ))}
          <p className="bg-surface-muted/40 px-4 py-2 text-center text-xs text-muted">
            {rows.length} {rows.length === 1 ? "transação" : "transações"} em {formatMonth(month)}
          </p>
        </div>
      )}
    </div>
  );
}

function TransactionsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Carregando transações">
      <div className="flex gap-2">
        <div className={`${skeleton} h-14 flex-1 sm:w-52 sm:flex-none`} />
        <div className={`${skeleton} h-14 flex-1 sm:w-52 sm:flex-none`} />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className={`${skeleton} h-20`} />
        ))}
      </div>
      <div className={`${card} divide-y divide-border`}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3">
            <div className={`${skeleton} size-9 rounded-full`} />
            <div className="flex flex-1 flex-col gap-2">
              <div className={`${skeleton} h-3.5 w-2/5`} />
              <div className={`${skeleton} h-3 w-1/4`} />
            </div>
            <div className={`${skeleton} h-4 w-20`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transações</h1>
          <p className="mt-1 text-sm text-muted">Lançamentos da conta e do cartão no mês selecionado.</p>
        </div>
        <Link href="/categories" className={`${buttonSecondary} shrink-0`}>
          Categorias
        </Link>
      </div>
      <Suspense fallback={<TransactionsSkeleton />}>
        <Transactions searchParams={searchParams} />
      </Suspense>
    </>
  );
}

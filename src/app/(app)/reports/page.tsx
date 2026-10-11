import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowDownLeftIcon, ArrowUpRightIcon, SwapIcon, UploadIcon } from "@/components/icons";
import { badge, buttonPrimary, card, skeleton } from "@/components/ui";
import { formatCents, formatMonth, formatPercent, parseMonth } from "@/lib/format";
import { addMonths } from "@/lib/reports/months";
import {
  futureInstallments,
  monthlyEvolution,
  monthSummary,
  RECURRING_MIN_MONTHS,
  recurringSpending,
  spendingByCategory,
  spendingChange,
  topMerchants,
  type CategorySpending,
  type FutureInstallments,
  type MerchantSpending,
  type RecurringSpending,
  type ReportCategory,
} from "@/lib/reports/reports";
import { requireSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { loadReportRows } from "@/server/reports/load-report-rows";
import { listMonths } from "@/server/transactions/list-transactions";
import { EvolutionChart } from "./evolution-chart";
import { MonthSelect } from "./month-select";

export const metadata: Metadata = { title: "Relatórios | Financial" };

const EVOLUTION_MONTHS = 6;
const TOP_MERCHANTS = 10;
const INSTALLMENT_MONTHS = 12;

function Section(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className={`${card} flex flex-col gap-4 p-4 sm:p-5`}>
      <div>
        <h2 className="text-base font-semibold tracking-tight">{props.title}</h2>
        {props.description && <p className="mt-0.5 text-sm text-muted">{props.description}</p>}
      </div>
      {props.children}
    </section>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted">{children}</p>;

function CategoryLabel({ category }: { category: ReportCategory | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={`size-2.5 shrink-0 rounded-full ${category ? "" : "border-2 border-dashed border-muted"}`}
        style={category ? { backgroundColor: category.color } : undefined}
        aria-hidden="true"
      />
      <span className="truncate">{category?.name ?? "Sem categoria"}</span>
    </span>
  );
}

function Tile(props: {
  label: string;
  cents: number;
  tone: string;
  icon: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`${card} flex min-w-0 flex-col gap-1.5 p-3 sm:p-4 ${props.className ?? ""}`}>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <span className={`grid size-5 shrink-0 place-items-center rounded-full text-xs ${props.tone}`}>{props.icon}</span>
        {props.label}
      </dt>
      <dd className="truncate text-lg font-semibold sm:text-xl">{formatCents(props.cents)}</dd>
      {props.children}
    </div>
  );
}

function SpendingDelta({ change, previousMonth }: { change: number | null; previousMonth: string }) {
  if (change === null) {
    return null;
  }
  const previous = formatMonth(previousMonth).split(" ")[0];
  if (Math.abs(change) < 0.005) {
    return <p className="text-xs text-muted">igual a {previous}</p>;
  }
  const more = change > 0;
  return (
    <p className={`flex flex-wrap items-center gap-x-1 text-xs ${more ? "text-negative" : "text-positive"}`}>
      <span className="font-semibold">
        {more ? "▲" : "▼"} {formatPercent(Math.abs(change))}
      </span>
      <span className="text-muted">
        {more ? "a mais" : "a menos"} que {previous}
      </span>
    </p>
  );
}

function CategoryBars({ categories, month }: { categories: CategorySpending[]; month: string }) {
  if (categories.length === 0) {
    return <Empty>Nenhum gasto neste mês.</Empty>;
  }
  const max = Math.max(...categories.map((entry) => entry.spentCents));

  return (
    <ul className="flex flex-col">
      {categories.map((entry) => (
        <li key={entry.category?.id ?? "none"}>
          <Link
            href={`/transactions?month=${month}&category=${entry.category?.id ?? "none"}`}
            className="group -mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-muted/60 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 font-medium">
                <CategoryLabel category={entry.category} />
              </span>
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="font-semibold">{formatCents(entry.spentCents)}</span>
                <span className="w-9 text-right text-xs text-muted">{formatPercent(entry.share)}</span>
              </span>
            </span>
            <span
              className="h-2 min-w-1 rounded-r bg-accent transition-opacity group-hover:opacity-85"
              style={{ width: `${(entry.spentCents / max) * 100}%` }}
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MerchantList({ merchants }: { merchants: MerchantSpending[] }) {
  if (merchants.length === 0) {
    return <Empty>Nenhum gasto com estabelecimento identificado neste mês.</Empty>;
  }
  return (
    <ol className="flex flex-col divide-y divide-border">
      {merchants.map((entry, index) => (
        <li key={entry.merchant} className="flex items-center gap-3 py-2.5">
          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={entry.merchant}>
              {entry.merchant}
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              <CategoryLabel category={entry.category} />
              <span className="shrink-0">
                · {entry.transactionCount} {entry.transactionCount === 1 ? "compra" : "compras"}
              </span>
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">{formatCents(entry.spentCents)}</p>
        </li>
      ))}
    </ol>
  );
}

function RecurringList({ recurring }: { recurring: RecurringSpending[] }) {
  if (recurring.length === 0) {
    return (
      <Empty>
        Nenhuma cobrança repetida por {RECURRING_MIN_MONTHS} meses seguidos. Com menos de {RECURRING_MIN_MONTHS} meses
        de histórico importado, esta lista fica vazia.
      </Empty>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {recurring.map((entry) => (
        <li key={entry.merchant} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={entry.merchant}>
              {entry.merchant}
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              <CategoryLabel category={entry.category} />
              <span className="shrink-0">· há {entry.months} meses</span>
            </p>
          </div>
          <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
            {formatCents(entry.averageCents)}
            <span className="text-xs font-normal text-muted">/mês</span>
            <span className="block text-xs font-normal text-muted">{formatCents(entry.yearlyCents)} por ano</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

function Installments({ installments }: { installments: FutureInstallments }) {
  if (installments.purchases.length === 0) {
    return <Empty>Nenhuma compra parcelada em aberto.</Empty>;
  }
  const lastCharged = installments.byMonth.findLastIndex((entry) => entry.cents > 0);
  const months = installments.byMonth.slice(0, lastCharged + 1);
  const max = Math.max(...months.map((entry) => entry.cents));

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm">
        <span className="text-xl font-semibold">{formatCents(installments.totalCents)}</span>{" "}
        <span className="text-muted">já comprometidos nos próximos meses</span>
      </p>

      <ul className="flex flex-col gap-2">
        {months.map((entry) => (
          <li key={entry.month} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm">
            <span className="text-muted">
              {formatMonth(entry.month).split(" ")[0].slice(0, 3)}/{entry.month.slice(2, 4)}
            </span>
            <span className="flex h-2 items-stretch" aria-hidden="true">
              <span className="min-w-1 rounded-r bg-accent" style={{ width: `${(entry.cents / max) * 100}%` }} />
            </span>
            <span className="font-medium tabular-nums">{formatCents(entry.cents)}</span>
          </li>
        ))}
      </ul>

      <ul className="flex flex-col divide-y divide-border border-t border-border">
        {installments.purchases.map((purchase, index) => (
          <li key={`${index}-${purchase.merchant}`} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={purchase.merchant ?? undefined}>
                {purchase.merchant ?? "Compra parcelada"}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span className={badge.warning}>
                  parcela {purchase.currentNumber}/{purchase.total}
                </span>
                <span>
                  {purchase.remaining === 1 ? "falta 1" : `faltam ${purchase.remaining}`} · até {formatMonth(purchase.endMonth)}
                </span>
              </p>
            </div>
            <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
              {formatCents(purchase.monthlyCents)}
              <span className="text-xs font-normal text-muted">/mês</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NoData() {
  return (
    <div className={`${card} flex flex-col items-center gap-4 px-6 py-12 text-center`}>
      <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-2xl text-accent">
        <UploadIcon />
      </span>
      <div>
        <p className="font-semibold">Ainda não há o que mostrar</p>
        <p className="mt-1 text-sm text-muted">Importe um extrato do Nubank para ver seus relatórios.</p>
      </div>
      <Link href="/import" className={buttonPrimary}>
        Importar extrato
      </Link>
    </div>
  );
}

async function Reports({ searchParams }: Pick<PageProps<"/reports">, "searchParams">) {
  await requireSession();
  const params = await searchParams;
  const months = await listMonths(getDb());
  if (months.length === 0) {
    return <NoData />;
  }

  const month = typeof params.month === "string" && parseMonth(params.month) ? params.month : months[0];
  const monthOptions = months.includes(month) ? months : [month, ...months].sort().reverse();
  const rows = await loadReportRows(getDb(), month);
  const summary = monthSummary(rows, month);
  const monthName = formatMonth(month);

  return (
    <div className="flex flex-col gap-5">
      <MonthSelect months={monthOptions} month={month} />

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <Tile
          label="Gasto"
          className="col-span-2 sm:col-span-1"
          cents={summary.spentCents}
          tone="bg-negative-soft text-negative"
          icon={<ArrowUpRightIcon />}
        >
          <SpendingDelta change={spendingChange(rows, month)} previousMonth={addMonths(month, -1)} />
        </Tile>
        <Tile
          label="Receita"
          cents={summary.incomeCents}
          tone="bg-positive-soft text-positive"
          icon={<ArrowDownLeftIcon />}
        />
        <Tile label="Saldo" cents={summary.netCents} tone="bg-accent-soft text-accent" icon={<SwapIcon />} />
      </dl>

      <Section title="Gasto por categoria" description={`Para onde foi o dinheiro em ${monthName}.`}>
        <CategoryBars categories={spendingByCategory(rows, month)} month={month} />
      </Section>

      <Section title="Evolução" description={`Gasto total nos ${EVOLUTION_MONTHS} meses até ${monthName}.`}>
        <EvolutionChart months={monthlyEvolution(rows, month, EVOLUTION_MONTHS)} selected={month} />
      </Section>

      <Section title="Maiores estabelecimentos" description={`Onde você mais gastou em ${monthName}.`}>
        <MerchantList merchants={topMerchants(rows, month, TOP_MERCHANTS)} />
      </Section>

      <Section title="Recorrentes" description="Cobranças que se repetem todo mês, como assinaturas.">
        <RecurringList recurring={recurringSpending(rows, month)} />
      </Section>

      <Section title="Parcelas futuras" description={`O que já está comprometido depois de ${monthName}.`}>
        <Installments installments={futureInstallments(rows, month, INSTALLMENT_MONTHS)} />
      </Section>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Carregando relatórios">
      <div className={`${skeleton} h-14 w-full sm:w-48`} />
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className={`${skeleton} h-20`} />
        ))}
      </div>
      {[0, 1, 2].map((index) => (
        <div key={index} className={`${card} flex flex-col gap-4 p-5`}>
          <div className={`${skeleton} h-5 w-40`} />
          {[0, 1, 2].map((line) => (
            <div key={line} className={`${skeleton} h-4`} style={{ width: `${90 - line * 22}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="mt-1 text-sm text-muted">Onde está indo a maior parte do seu dinheiro.</p>
      </div>
      <Suspense fallback={<ReportsSkeleton />}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </>
  );
}

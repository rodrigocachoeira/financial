import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowDownLeftIcon, ArrowUpRightIcon, SwapIcon, TrendingUpIcon, UploadIcon } from "@/components/icons";
import { badge, buttonPrimary, card, skeleton } from "@/components/ui";
import { balanceEvolution, type MonthBalance } from "@/lib/reports/balance";
import { formatCents, formatDate, formatMonth, formatPercent, parseMonth } from "@/lib/format";
import { buildInsightsPayload } from "@/lib/insights/payload";
import { buildInsightsPrompt } from "@/lib/insights/prompt";
import { addMonths, addMonthsToDate } from "@/lib/reports/months";
import {
  futureInstallments,
  monthlyEvolution,
  monthSummary,
  RECURRING_MIN_MONTHS,
  recurringSpending,
  spendingChange,
  spendingVsAverage,
  topMerchants,
  type FutureInstallments,
  type RecurringSpending,
} from "@/lib/reports/reports";
import { hasMultiMonthStatement, yieldEvolution, type MonthYield } from "@/lib/reports/yield";
import { requireSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { loadBalanceSources } from "@/server/reports/load-balance-sources";
import { loadReportRows } from "@/server/reports/load-report-rows";
import { loadYieldSources } from "@/server/reports/load-yield-sources";
import { listMonths } from "@/server/transactions/list-transactions";
import { EvolutionChart } from "./evolution-chart";
import { InsightsCard } from "./insights-card";
import { MonthSelect } from "./month-select";
import { CategoryBars, CategoryLabel, Empty, MerchantList, MonthBarList, Section, Tile } from "./parts";

export const metadata: Metadata = { title: "Relatórios | Financial" };

const EVOLUTION_MONTHS = 6;
const TOP_MERCHANTS = 10;
const INSTALLMENT_MONTHS = 12;

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
            {formatCents(entry.lastCents)}
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

const dayAndMonth = (isoDate: string) => formatDate(isoDate).slice(0, 5);
const lastDayOfMonth = (month: string) => addMonthsToDate(`${month}-31`, 0);

function YieldNote({ entry }: { entry: MonthYield }) {
  if (entry.cents === null) {
    return <p className="text-xs text-muted">sem extrato da conta no mês</p>;
  }
  return entry.partialUntil ? <p className="text-xs text-muted">parcial, até {dayAndMonth(entry.partialUntil)}</p> : null;
}

function YieldList({ months, multiMonth }: { months: MonthYield[]; multiMonth: boolean }) {
  const known = months.filter((entry) => entry.cents !== null);
  if (known.length === 0) {
    return (
      <Empty>
        Nenhum extrato da conta com o rendimento do período. Reenvie os extratos da conta, um por mês, para preencher
        esta seção.
      </Empty>
    );
  }
  const total = known.reduce((sum, entry) => sum + entry.cents!, 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        <span className="text-xl font-semibold">{formatCents(total)}</span>{" "}
        <span className="text-muted">
          em {known.length} {known.length === 1 ? "mês" : "meses"} com extrato
        </span>
      </p>
      <MonthBarList
        missing="sem extrato"
        months={months.map((entry) => ({
          month: entry.month,
          cents: entry.cents,
          note: entry.partialUntil ? `até ${dayAndMonth(entry.partialUntil)}` : null,
        }))}
      />
      {multiMonth && (
        <p className="text-xs text-muted">
          Há um extrato que cobre mais de um mês. O banco informa um único valor para o período inteiro, então ele não
          entra aqui; exporte um extrato por mês.
        </p>
      )}
    </div>
  );
}

function BalanceList({ months }: { months: MonthBalance[] }) {
  const known = months.filter((entry) => entry.cents !== null);
  if (known.length === 0) {
    return <Empty>Nenhum extrato da conta importado neste período.</Empty>;
  }
  const latest = known.at(-1)!;
  const first = known[0];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        <span className="text-xl font-semibold">{formatCents(latest.cents!)}</span>{" "}
        <span className="text-muted">em {formatDate(latest.date!)}</span>
        {known.length > 1 && (
          <span className="block text-xs text-muted">
            {latest.cents! >= first.cents! ? "▲" : "▼"} {formatCents(Math.abs(latest.cents! - first.cents!))} desde{" "}
            {formatDate(first.date!)}
          </span>
        )}
      </p>
      <MonthBarList
        missing="sem extrato"
        months={months.map((entry) => ({
          month: entry.month,
          cents: entry.cents,
          // The balance of a statement that stops mid-month is not the month's closing balance.
          note: entry.date && entry.date !== lastDayOfMonth(entry.month) ? `em ${dayAndMonth(entry.date)}` : null,
        }))}
      />
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
  const [rows, yieldSources, balanceSources] = await Promise.all([
    loadReportRows(getDb(), month),
    loadYieldSources(getDb()),
    loadBalanceSources(getDb()),
  ]);
  const summary = monthSummary(rows, month);
  const yields = yieldEvolution(yieldSources, month, EVOLUTION_MONTHS);
  const monthYield = yields.at(-1)!;
  const monthName = formatMonth(month);

  return (
    <div className="flex flex-col gap-5">
      <MonthSelect months={monthOptions} month={month} />

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
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
        <Tile
          label="Rendimento"
          className="col-span-2 sm:col-span-1"
          cents={monthYield.cents}
          tone="bg-positive-soft text-positive"
          icon={<TrendingUpIcon />}
        >
          <YieldNote entry={monthYield} />
        </Tile>
      </dl>

      <InsightsCard
        // Remounting per month clears the "copied" state when the month changes.
        key={month}
        prompt={summary.spentCents > 0 ? buildInsightsPrompt(buildInsightsPayload(rows, month, yieldSources)) : null}
        monthName={monthName}
      />

      <Section
        title="Gasto por categoria"
        description={`Para onde foi o dinheiro em ${monthName}, comparado com a média dos meses anteriores.`}
      >
        <CategoryBars
          categories={spendingVsAverage(rows, month)}
          empty="Nenhum gasto neste mês."
          hrefFor={(category) => `/transactions?month=${month}&category=${category?.id ?? "none"}`}
        />
      </Section>

      <Section title="Evolução" description={`Gasto total nos ${EVOLUTION_MONTHS} meses até ${monthName}.`}>
        <EvolutionChart months={monthlyEvolution(rows, month, EVOLUTION_MONTHS)} selected={month} />
      </Section>

      <Section title="Maiores estabelecimentos" description={`Onde você mais gastou em ${monthName}.`}>
        <MerchantList
          merchants={topMerchants(rows, month, TOP_MERCHANTS)}
          empty="Nenhum gasto com estabelecimento identificado neste mês."
        />
      </Section>

      <Section
        title="Recorrentes"
        description="Cobranças que se repetem todo mês, como assinaturas."
        action={
          <Link href="/reports/subscriptions" className="shrink-0 text-sm font-medium text-accent hover:underline">
            Ver detalhes
          </Link>
        }
      >
        <RecurringList recurring={recurringSpending(rows, month)} />
      </Section>

      <Section title="Parcelas futuras" description={`O que já está comprometido depois de ${monthName}.`}>
        <Installments installments={futureInstallments(rows, month, INSTALLMENT_MONTHS)} />
      </Section>

      <Section title="Saldo da conta" description="Saldo ao fim de cada extrato da conta importado.">
        <BalanceList months={balanceEvolution(balanceSources, month, EVOLUTION_MONTHS)} />
      </Section>

      <Section
        title="Rendimento da conta"
        description="Rendimento líquido que o banco informa em cada extrato da conta. Não entra na receita nem no saldo acima."
      >
        <YieldList
          months={yields}
          multiMonth={hasMultiMonthStatement(yieldSources, month, EVOLUTION_MONTHS)}
        />
      </Section>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Carregando relatórios">
      <div className={`${skeleton} h-14 w-full sm:w-48`} />
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[0, 1, 2, 3].map((index) => (
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
    <Suspense fallback={<ReportsSkeleton />}>
      <Reports searchParams={searchParams} />
    </Suspense>
  );
}

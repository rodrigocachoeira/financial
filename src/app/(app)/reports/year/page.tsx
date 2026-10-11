import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrowDownLeftIcon, ArrowUpRightIcon, SwapIcon, TrendingUpIcon } from "@/components/icons";
import { buttonSecondary, card, skeleton } from "@/components/ui";
import { formatCents } from "@/lib/format";
import { monthsOfYear } from "@/lib/reports/months";
import { categoryBreakdown, merchantRanking, monthlyEvolution, summarize } from "@/lib/reports/reports";
import { monthYield } from "@/lib/reports/yield";
import { requireSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { loadYearRows } from "@/server/reports/load-report-rows";
import { loadYieldSources } from "@/server/reports/load-yield-sources";
import { listMonths } from "@/server/transactions/list-transactions";
import { EvolutionChart } from "../evolution-chart";
import { CategoryBars, Empty, MerchantList, Section, Tile } from "../parts";
import { YearSelect } from "./year-select";

export const metadata: Metadata = { title: "Relatório anual | Financial" };

const TOP_MERCHANTS = 10;

async function YearReport({ searchParams }: Pick<PageProps<"/reports/year">, "searchParams">) {
  await requireSession();
  const params = await searchParams;
  const years = [...new Set((await listMonths(getDb())).map((month) => month.slice(0, 4)))];
  if (years.length === 0) {
    return (
      <div className={`${card} px-6 py-12 text-center`}>
        <Empty>Importe um extrato para ver o resumo do ano.</Empty>
      </div>
    );
  }

  const year = typeof params.year === "string" && years.includes(params.year) ? params.year : years[0];
  const [rows, yieldSources] = await Promise.all([loadYearRows(getDb(), year), loadYieldSources(getDb())]);
  const summary = summarize(rows);
  const months = monthlyEvolution(rows, `${year}-12`, 12);
  const monthsWithSpending = months.filter((entry) => entry.spentCents > 0).length;
  const yields = monthsOfYear(year)
    .map((month) => monthYield(yieldSources, month).cents)
    .filter((cents): cents is number => cents !== null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <YearSelect years={years} year={year} />
        {/* A plain link: the browser downloads the file the route returns. */}
        <a href={`/api/export/transactions?period=${year}`} className={buttonSecondary}>
          Exportar CSV do ano
        </a>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Tile
          label="Gasto no ano"
          className="col-span-2 sm:col-span-1"
          cents={summary.spentCents}
          tone="bg-negative-soft text-negative"
          icon={<ArrowUpRightIcon />}
        >
          {monthsWithSpending > 0 && (
            <p className="text-xs text-muted">
              média de {formatCents(Math.round(summary.spentCents / monthsWithSpending))} em {monthsWithSpending}{" "}
              {monthsWithSpending === 1 ? "mês" : "meses"}
            </p>
          )}
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
          cents={yields.length > 0 ? yields.reduce((total, cents) => total + cents, 0) : null}
          tone="bg-positive-soft text-positive"
          icon={<TrendingUpIcon />}
        >
          <p className="text-xs text-muted">
            {yields.length > 0
              ? `${yields.length} ${yields.length === 1 ? "mês" : "meses"} com extrato da conta`
              : "sem extrato da conta no ano"}
          </p>
        </Tile>
      </dl>

      <Section title="Gasto por mês" description={`Toque em um mês para abrir o relatório dele. Meses sem extrato aparecem vazios.`}>
        <EvolutionChart months={months} selected={null} />
      </Section>

      <Section title="Gasto por categoria" description={`Para onde foi o dinheiro em ${year}.`}>
        <CategoryBars categories={categoryBreakdown(rows)} empty="Nenhum gasto neste ano." />
      </Section>

      <Section title="Maiores estabelecimentos" description={`Onde você mais gastou em ${year}.`}>
        <MerchantList
          merchants={merchantRanking(rows, TOP_MERCHANTS)}
          empty="Nenhum gasto com estabelecimento identificado neste ano."
        />
      </Section>
    </div>
  );
}

function YearSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Carregando relatório anual">
      <div className={`${skeleton} h-14 w-full sm:w-48`} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className={`${skeleton} h-20`} />
        ))}
      </div>
      <div className={`${skeleton} h-64`} />
      <div className={`${skeleton} h-48`} />
    </div>
  );
}

export default function YearPage({ searchParams }: PageProps<"/reports/year">) {
  return (
    <Suspense fallback={<YearSkeleton />}>
      <YearReport searchParams={searchParams} />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { card, skeleton } from "@/components/ui";
import { budgetReport } from "@/lib/budget/budget";
import { formatMonth, parseMonth } from "@/lib/format";
import { currentMonthIn } from "@/lib/reports/months";
import { requireSession } from "@/server/auth/session";
import { loadBudgets } from "@/server/budget/budgets";
import { listCategories } from "@/server/categorization/list-categories";
import { getDb } from "@/server/db";
import { loadReportRows } from "@/server/reports/load-report-rows";
import { listMonths } from "@/server/transactions/list-transactions";
import { MonthSelect } from "../month-select";
import { Empty } from "../parts";
import { BudgetBoard } from "./budget-board";

export const metadata: Metadata = { title: "Orçamento | Financial" };

const TIME_ZONE = "America/Sao_Paulo";

async function Budget({ searchParams }: Pick<PageProps<"/reports/budget">, "searchParams">) {
  await requireSession();
  const params = await searchParams;
  const months = await listMonths(getDb());
  if (months.length === 0) {
    return (
      <div className={`${card} px-6 py-12 text-center`}>
        <Empty>Importe um extrato para montar um orçamento.</Empty>
      </div>
    );
  }

  const month = typeof params.month === "string" && parseMonth(params.month) ? params.month : months[0];
  const monthOptions = months.includes(month) ? months : [month, ...months].sort().reverse();
  const [rows, entries, categories] = await Promise.all([
    loadReportRows(getDb(), month),
    loadBudgets(getDb()),
    listCategories(getDb()),
  ]);
  const report = budgetReport({ rows, entries, categories, month, currentMonth: currentMonthIn(TIME_ZONE) });

  return (
    <div className="flex flex-col gap-5">
      <MonthSelect months={monthOptions} month={month} basePath="/reports/budget" />
      <BudgetBoard report={report} monthName={formatMonth(month)} />
    </div>
  );
}

function BudgetSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Carregando orçamento">
      <div className={`${skeleton} h-14 w-48`} />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className={`${skeleton} h-20`} />
        ))}
      </div>
      <div className={`${skeleton} h-72`} />
    </div>
  );
}

export default function BudgetPage({ searchParams }: PageProps<"/reports/budget">) {
  return (
    <Suspense fallback={<BudgetSkeleton />}>
      <Budget searchParams={searchParams} />
    </Suspense>
  );
}

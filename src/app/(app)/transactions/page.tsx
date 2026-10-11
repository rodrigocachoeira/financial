import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatCents, formatDate, formatMonth, parseMonth } from "@/lib/format";
import type { Source } from "@/lib/ofx";
import { requireSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { listMonths, listTransactions, type TransactionRow } from "@/server/transactions/list-transactions";
import { SOURCE_LABELS } from "../labels";
import { TransactionFilters } from "./transaction-filters";

export const metadata: Metadata = { title: "Transações | Financial" };

const isSource = (value: unknown): value is Source => value === "ACCOUNT" || value === "CREDIT_CARD";

function Total({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums sm:text-base">{formatCents(cents)}</dd>
    </div>
  );
}

function TransactionItem({ row }: { row: TransactionRow }) {
  const amountColor = row.internalTransfer
    ? "text-zinc-500"
    : row.amountCents > 0
      ? "text-emerald-700 dark:text-emerald-400"
      : "";
  return (
    <li className={`flex items-start justify-between gap-3 py-3 ${row.internalTransfer ? "opacity-60" : ""}`}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={row.description}>
          {row.merchant ?? (row.description || "Sem descrição")}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-zinc-500">
          <span>{formatDate(row.date)}</span>
          <span>{SOURCE_LABELS[row.source]}</span>
          {row.installment && (
            <span>
              parcela {row.installment.number}/{row.installment.total}
            </span>
          )}
          {row.internalTransfer && <span>transferência interna</span>}
        </p>
      </div>
      <p className={`shrink-0 text-sm font-semibold tabular-nums ${amountColor}`}>{formatCents(row.amountCents)}</p>
    </li>
  );
}

async function Transactions({ searchParams }: Pick<PageProps<"/transactions">, "searchParams">) {
  await requireSession();
  const params = await searchParams;
  const months = await listMonths(getDb());

  if (months.length === 0) {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        Nenhuma transação ainda.{" "}
        <Link href="/import" className="font-medium underline">
          Importe um extrato
        </Link>{" "}
        para começar.
      </p>
    );
  }

  const month = typeof params.month === "string" && parseMonth(params.month) ? params.month : months[0];
  const source = isSource(params.account) ? params.account : undefined;
  const { rows, totals } = await listTransactions(getDb(), { month, source });
  const monthOptions = months.includes(month) ? months : [month, ...months].sort().reverse();

  return (
    <div className="flex flex-col gap-5">
      <TransactionFilters months={monthOptions} month={month} source={source ?? ""} />
      <dl className="grid grid-cols-3 gap-2">
        <Total label="Entradas" cents={totals.inCents} />
        <Total label="Saídas" cents={totals.outCents} />
        <Total label="Saldo" cents={totals.netCents} />
      </dl>
      {rows.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">Nenhuma transação em {formatMonth(month)}.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((row) => (
            <TransactionItem key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Transações</h1>
      <Suspense fallback={<p className="text-zinc-500">Carregando…</p>}>
        <Transactions searchParams={searchParams} />
      </Suspense>
    </>
  );
}

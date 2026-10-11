"use client";

import { useRouter } from "next/navigation";
import { formatMonth } from "@/lib/format";
import { SOURCE_LABELS } from "../labels";

interface Props {
  months: string[];
  month: string;
  source: string;
}

const SELECT =
  "rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm dark:border-zinc-700";

const capitalizeFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function TransactionFilters({ months, month, source }: Props) {
  const router = useRouter();

  function update(next: { month?: string; source?: string }) {
    const params = new URLSearchParams({ month: next.month ?? month });
    const account = next.source ?? source;
    if (account) {
      params.set("account", account);
    }
    router.push(`/transactions?${params}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Mês
        <select className={SELECT} value={month} onChange={(event) => update({ month: event.target.value })}>
          {months.map((option) => (
            <option key={option} value={option}>
              {capitalizeFirst(formatMonth(option))}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Conta
        <select className={SELECT} value={source} onChange={(event) => update({ source: event.target.value })}>
          <option value="">Todas</option>
          {Object.entries(SOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

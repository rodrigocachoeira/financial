"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FilterSelect } from "@/components/filter-select";
import { Spinner } from "@/components/icons";
import { formatMonth } from "@/lib/format";

const capitalizeFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function MonthSelect({ months, month }: { months: string[]; month: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-end gap-2">
      <FilterSelect
        label="Mês"
        className="flex-1 sm:flex-none"
        value={month}
        options={months.map((option) => ({ value: option, label: capitalizeFirst(formatMonth(option)) }))}
        onChange={(next) => startTransition(() => router.push(`/reports?month=${next}`))}
      />
      <span className="grid h-10 w-6 place-items-center text-lg text-accent" aria-live="polite">
        {pending && <Spinner aria-label="Carregando" aria-hidden={false} role="status" />}
      </span>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FilterSelect } from "@/components/filter-select";
import { Spinner } from "@/components/icons";

export function YearSelect({ years, year }: { years: string[]; year: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-end gap-2">
      <FilterSelect
        label="Ano"
        className="flex-1 sm:flex-none"
        value={year}
        options={years.map((option) => ({ value: option, label: option }))}
        onChange={(next) => startTransition(() => router.push(`/reports/year?year=${next}`))}
      />
      <span className="grid h-10 w-6 place-items-center text-lg text-accent" aria-live="polite">
        {pending && <Spinner aria-label="Carregando" aria-hidden={false} role="status" />}
      </span>
    </div>
  );
}

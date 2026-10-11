"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FilterSelect } from "@/components/filter-select";
import { Spinner } from "@/components/icons";
import type { SelectOption } from "@/components/select-menu";
import { formatMonth } from "@/lib/format";
import type { CategoryOption } from "@/server/categorization/list-categories";
import { SOURCE_LABELS } from "../labels";

interface Filters {
  month: string;
  source: string;
  category: string;
}

interface Props extends Filters {
  months: string[];
  categories: CategoryOption[];
}

const capitalizeFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function TransactionFilters({ months, categories, ...current }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(change: Partial<Filters>) {
    const next = { ...current, ...change };
    const params = new URLSearchParams({ month: next.month });
    if (next.source) {
      params.set("account", next.source);
    }
    if (next.category) {
      params.set("category", next.category);
    }
    startTransition(() => router.push(`/transactions?${params}`));
  }

  const monthOptions = months.map((month) => ({ value: month, label: capitalizeFirst(formatMonth(month)) }));
  const sourceOptions = [
    { value: "", label: "Todas" },
    ...Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label })),
  ];
  const categoryOptions: SelectOption[] = [
    { value: "", label: "Todas" },
    { value: "none", label: "Sem categoria", color: null },
    ...categories.map((category) => ({ value: category.id, label: category.name, color: category.color })),
  ];

  return (
    <div className="grid grid-cols-2 items-end gap-2 sm:flex">
      <FilterSelect label="Mês" value={current.month} options={monthOptions} onChange={(month) => update({ month })} />
      <FilterSelect label="Conta" value={current.source} options={sourceOptions} onChange={(source) => update({ source })} />
      <FilterSelect
        label="Categoria"
        className="col-span-2"
        searchable
        value={current.category}
        options={categoryOptions}
        onChange={(category) => update({ category })}
      />
      <span className="col-span-2 grid h-5 place-items-center text-lg text-accent sm:h-10 sm:w-6" aria-live="polite">
        {pending && <Spinner aria-label="Carregando" aria-hidden={false} role="status" />}
      </span>
    </div>
  );
}

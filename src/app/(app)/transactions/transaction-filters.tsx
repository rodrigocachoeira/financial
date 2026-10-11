"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronDownIcon, Spinner } from "@/components/icons";
import { SelectMenu, type SelectOption } from "@/components/select-menu";
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

const FIELD =
  "flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-surface py-2.5 pl-3 pr-2.5 text-left text-sm font-medium text-foreground shadow-sm transition hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-expanded:border-accent sm:w-48";

function Filter(props: {
  label: string;
  value: string;
  options: SelectOption[];
  className?: string;
  onChange: (value: string) => void;
}) {
  const current = props.options.find((option) => option.value === props.value);
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${props.className ?? ""}`}>
      <span className="text-xs font-medium text-muted" aria-hidden="true">
        {props.label}
      </span>
      <SelectMenu
        label={props.label}
        value={props.value}
        options={props.options}
        onChange={props.onChange}
        triggerClassName={FIELD}
      >
        <span className="flex min-w-0 items-center gap-2">
          {current?.color && (
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: current.color }} aria-hidden="true" />
          )}
          <span className="truncate">{current?.label}</span>
        </span>
        <ChevronDownIcon className="shrink-0 text-base text-muted" />
      </SelectMenu>
    </div>
  );
}

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
      <Filter label="Mês" value={current.month} options={monthOptions} onChange={(month) => update({ month })} />
      <Filter label="Conta" value={current.source} options={sourceOptions} onChange={(source) => update({ source })} />
      <Filter
        label="Categoria"
        className="col-span-2"
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

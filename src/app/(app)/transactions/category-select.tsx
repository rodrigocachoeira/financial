"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { ChevronDownIcon, Spinner } from "@/components/icons";
import { SelectMenu, type SelectOption } from "@/components/select-menu";
import { useToast } from "@/components/toast";
import type { CategoryOption } from "@/server/categorization/list-categories";
import { createCategoryForTransactionAction, setCategoryAction } from "./actions";

interface Props {
  transactionId: string;
  /** Current category id, or "" when there is none. */
  value: string;
  categories: CategoryOption[];
}

const NO_CATEGORY = "Sem categoria";

/** A category badge that is also the control to change it, or to create a new category. */
export function CategorySelect({ transactionId, value, categories }: Props) {
  const [pending, startTransition] = useTransition();
  // `name` is set while a category that does not exist yet is being created.
  const [selected, setSelected] = useOptimistic<{ id: string; name?: string }>({ id: value });
  const toast = useToast();
  const category = categories.find((option) => option.id === selected.id);
  const label = selected.name ?? category?.name ?? NO_CATEGORY;

  const options: SelectOption[] = [
    { value: "", label: NO_CATEGORY, color: null },
    ...categories.map((option) => ({ value: option.id, label: option.name, color: option.color })),
  ];

  function change(next: string) {
    startTransition(async () => {
      setSelected({ id: next });
      toast(await setCategoryAction(transactionId, next));
    });
  }

  function create(name: string) {
    startTransition(async () => {
      setSelected({ id: "", name });
      toast(await createCategoryForTransactionAction(transactionId, name));
    });
  }

  return (
    <SelectMenu
      label="Categoria"
      value={selected.id}
      options={options}
      onChange={change}
      onCreate={create}
      searchable
      disabled={pending}
      footer={
        <Link href="/categories" className="font-medium text-accent hover:underline">
          Gerenciar categorias
        </Link>
      }
      triggerClassName={`inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full py-1 pl-2.5 pr-2 text-xs font-medium transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70 ${
        category ? "text-foreground" : "bg-warning-soft text-warning"
      }`}
      triggerStyle={category ? { backgroundColor: `color-mix(in srgb, ${category.color} 18%, transparent)` } : undefined}
    >
      {pending ? (
        <Spinner className="shrink-0" />
      ) : (
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: category?.color ?? "currentColor" }}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{label}</span>
      <ChevronDownIcon className="shrink-0 opacity-70" />
    </SelectMenu>
  );
}

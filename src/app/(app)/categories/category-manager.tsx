"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Dialog } from "@/components/dialog";
import { AlertIcon, CheckIcon, PencilIcon, PlusIcon, Spinner, TrashIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { badge, buttonGhost, buttonPrimary, buttonSecondary, card } from "@/components/ui";
import { CATEGORY_COLORS, CATEGORY_NAME_MAX_LENGTH, pickCategoryColor } from "@/lib/categorization/category-name";
import type { CategoryWithUsage } from "@/server/categorization/manage-categories";
import { deleteCategoryAction, saveCategoryAction, type CategoryForm } from "./actions";

/** What the dialog is editing: a category, or a new one when `id` is absent. */
type Draft = CategoryForm & { transactionCount: number };

const usage = (count: number) => (count === 0 ? "sem transações" : count === 1 ? "1 transação" : `${count} transações`);

function CategoryDialog(props: { draft: Draft; onClose: () => void }) {
  const [draft, setDraft] = useState(props.draft);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function finish(action: () => ReturnType<typeof saveCategoryAction>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast(result);
        props.onClose();
      } else {
        setError(result.message);
      }
    });
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const { id, name, color, countsAsSpending } = draft;
    finish(() => saveCategoryAction({ id, name, color, countsAsSpending }));
  }

  if (confirmingDelete && draft.id) {
    const id = draft.id;
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Apagar <strong className="text-foreground">{props.draft.name}</strong>?{" "}
          {draft.transactionCount > 0
            ? `${usage(draft.transactionCount)[0].toUpperCase()}${usage(draft.transactionCount).slice(1)} ${
                draft.transactionCount === 1 ? "volta" : "voltam"
              } para “Sem categoria”, e os estabelecimentos deixam de ter essa categoria.`
            : "Nenhuma transação usa essa categoria."}{" "}
          Isso não pode ser desfeito.
        </p>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="flex justify-end gap-2">
          <button type="button" className={buttonSecondary} disabled={pending} onClick={() => setConfirmingDelete(false)}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => finish(() => deleteCategoryAction(id))}
            className={`${buttonPrimary} bg-negative shadow-negative/25 hover:bg-negative hover:brightness-95`}
          >
            {pending ? <Spinner /> : <TrashIcon />}
            Apagar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Nome
        <input
          type="text"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          maxLength={CATEGORY_NAME_MAX_LENGTH}
          required
          autoFocus
          autoComplete="off"
          // 16px on phones keeps iOS from zooming the page when the field is focused.
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-base font-normal outline-none transition focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 sm:text-sm"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Cor</legend>
        <div className="grid grid-cols-10 gap-2">
          {CATEGORY_COLORS.map((color) => (
            <label key={color} className="relative grid aspect-square cursor-pointer place-items-center">
              <input
                type="radio"
                name="color"
                value={color}
                checked={draft.color === color}
                onChange={() => setDraft({ ...draft, color })}
                className="peer absolute inset-0 cursor-pointer appearance-none rounded-full outline-none"
                aria-label={`Cor ${color}`}
              />
              <span
                className="grid size-full place-items-center rounded-full text-white ring-offset-2 ring-offset-surface transition peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-accent"
                style={{ backgroundColor: color }}
              >
                {draft.color === color && <CheckIcon className="text-sm" />}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={!draft.countsAsSpending}
          onChange={(event) => setDraft({ ...draft, countsAsSpending: !event.target.checked })}
          className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
        />
        <span>
          <span className="font-medium">Não contar como gasto</span>
          <span className="block text-muted">
            Para dinheiro que só muda de lugar, como transferências entre suas contas e investimentos. Fica fora dos
            relatórios.
          </span>
        </span>
      </label>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <div className="flex items-center justify-between gap-2">
        {draft.id ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              setConfirmingDelete(true);
            }}
            className={`${buttonGhost} text-negative hover:bg-negative-soft hover:text-negative`}
          >
            <TrashIcon />
            Apagar
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" className={buttonSecondary} disabled={pending} onClick={props.onClose}>
            Cancelar
          </button>
          <button type="submit" className={buttonPrimary} disabled={pending || draft.name.trim() === ""}>
            {pending && <Spinner />}
            {draft.id ? "Salvar" : "Criar"}
          </button>
        </div>
      </div>
    </form>
  );
}

function ErrorMessage({ children }: { children: string }) {
  return (
    <p role="alert" className="flex items-center gap-2 rounded-xl bg-negative-soft px-3 py-2 text-sm text-negative">
      <AlertIcon className="shrink-0 text-base" />
      {children}
    </p>
  );
}

export function CategoryManager({ categories }: { categories: CategoryWithUsage[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);

  const startCreating = () =>
    setDraft({
      name: "",
      color: pickCategoryColor(categories.map((category) => category.color)),
      countsAsSpending: true,
      transactionCount: 0,
    });

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={startCreating} className={`${buttonPrimary} self-start`}>
        <PlusIcon />
        Nova categoria
      </button>

      <ul className={`${card} divide-y divide-border overflow-hidden`}>
        {categories.map((category) => (
          <li key={category.id}>
            <button
              type="button"
              onClick={() => setDraft(category)}
              aria-label={`Editar ${category.name}`}
              className="group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-muted/60 focus-visible:bg-surface-muted/60 focus-visible:outline-none sm:px-4"
            >
              <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{category.name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  {usage(category.transactionCount)}
                  {!category.countsAsSpending && <span className={badge.neutral}>não conta como gasto</span>}
                </span>
              </span>
              <PencilIcon className="shrink-0 text-base text-muted transition-colors group-hover:text-foreground" />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "Editar categoria" : "Nova categoria"}>
        {draft && <CategoryDialog key={draft.id ?? "new"} draft={draft} onClose={() => setDraft(null)} />}
      </Dialog>
    </div>
  );
}

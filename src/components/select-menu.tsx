"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cleanCategoryName, matchesSearch, searchKey } from "@/lib/categorization/category-name";
import { CheckIcon, PlusIcon, SearchIcon } from "./icons";

export interface SelectOption {
  value: string;
  label: string;
  /** Hex color for a dot before the label; null draws an empty dot. Omit for no dot. */
  color?: string | null;
}

interface Props {
  /** Accessible name of the control and title of the sheet on small screens. */
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Adds a field that filters the options, ignoring accents and case. */
  searchable?: boolean;
  /** With `searchable`: offers to create an option from the typed text when none has that name. */
  onCreate?: (name: string) => void;
  /** Shown below the options, for a link related to the list. */
  footer?: ReactNode;
  triggerClassName: string;
  triggerStyle?: CSSProperties;
  /** Content of the trigger button. */
  children: ReactNode;
}

/** Where the list opens: a bottom sheet on phones, a floating list anchored to the trigger elsewhere. */
type Layout = "sheet" | { left: number; minWidth: number; maxHeight: number; top?: number; bottom?: number };

const DESKTOP = "(min-width: 640px)";
const GAP = 6;
const MARGIN = 12;
const MENU_WIDTH = 248;
const MENU_MAX_HEIGHT = 420;
const CREATE_MAX_LENGTH = 40;

function anchorTo(trigger: HTMLElement): Layout {
  const rect = trigger.getBoundingClientRect();
  const minWidth = Math.max(rect.width, MENU_WIDTH);
  const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - minWidth - MARGIN));
  const below = window.innerHeight - rect.bottom - GAP - MARGIN;
  const above = rect.top - GAP - MARGIN;
  if (below < 260 && above > below) {
    return { left, minWidth, maxHeight: Math.min(MENU_MAX_HEIGHT, above), bottom: window.innerHeight - rect.top + GAP };
  }
  return { left, minWidth, maxHeight: Math.min(MENU_MAX_HEIGHT, below), top: rect.bottom + GAP };
}

const OPTION =
  "flex w-full items-center gap-3 rounded-xl px-3 text-left outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted";

/** A select whose list we draw ourselves, so it has room, colors and a phone-friendly sheet. */
export function SelectMenu(props: Props) {
  const { label, value, options, onChange, disabled, searchable, onCreate, footer } = props;
  const [layout, setLayout] = useState<Layout | null>(null);
  const [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();
  const open = layout !== null;
  const sheet = layout === "sheet";
  // When some options have a dot, the others keep the same indent.
  const hasDots = options.some((option) => option.color !== undefined);

  const visible = searchable ? options.filter((option) => matchesSearch(option.label, query)) : options;
  const newName = cleanCategoryName(query);
  const canCreate =
    onCreate !== undefined &&
    newName !== "" &&
    newName.length <= CREATE_MAX_LENGTH &&
    !options.some((option) => searchKey(option.label) === searchKey(newName));

  function close(returnFocus = true) {
    setLayout(null);
    setQuery("");
    if (returnFocus) {
      trigger.current?.focus();
    }
  }

  function toggle() {
    if (open) {
      close();
    } else if (trigger.current) {
      setLayout(window.matchMedia(DESKTOP).matches ? anchorTo(trigger.current) : "sheet");
    }
  }

  function select(next: string) {
    close();
    if (next !== value) {
      onChange(next);
    }
  }

  function create() {
    close();
    onCreate?.(newName);
  }

  // When the list opens, focus the search field. On a phone that would raise the keyboard over
  // the list, so there the current option gets the focus and the field waits to be tapped.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (searchable && !sheet) {
      search.current?.focus();
      return;
    }
    const current = list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    (current ?? list.current?.querySelector<HTMLElement>('[role="option"]'))?.focus({ preventScroll: sheet });
    current?.scrollIntoView({ block: "nearest" });
  }, [open, sheet, searchable]);

  // The floating list is anchored to a spot on screen: close it when that spot moves.
  // The sheet covers the page instead, so the page behind it is locked, and it stays above
  // the on-screen keyboard, which on iOS overlaps the page without resizing it.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (sheet) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const viewport = window.visualViewport;
      const liftAboveKeyboard = () => {
        if (viewport && list.current) {
          const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
          list.current.style.bottom = `${covered}px`;
          list.current.style.maxHeight = `${Math.round(viewport.height * (covered > 0 ? 0.9 : 0.75))}px`;
        }
      };
      liftAboveKeyboard();
      viewport?.addEventListener("resize", liftAboveKeyboard);
      viewport?.addEventListener("scroll", liftAboveKeyboard);
      return () => {
        document.body.style.overflow = previous;
        viewport?.removeEventListener("resize", liftAboveKeyboard);
        viewport?.removeEventListener("scroll", liftAboveKeyboard);
      };
    }
    const dismiss = (event: Event) => {
      if (!(event.target instanceof Node) || !list.current?.contains(event.target)) {
        setLayout(null);
        setQuery("");
      }
    };
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open, sheet]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const inSearch = event.target === search.current;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focus = (target: number) => {
      event.preventDefault();
      items[(target + items.length) % items.length]?.focus();
    };

    switch (event.key) {
      case "ArrowDown":
        return focus(inSearch ? 0 : index + 1);
      case "ArrowUp":
        if (searchable && index <= 0) {
          event.preventDefault();
          return search.current?.focus();
        }
        return focus(index - 1);
      case "Home":
        return inSearch ? undefined : focus(0);
      case "End":
        return inSearch ? undefined : focus(items.length - 1);
      case "Enter":
        // In the search field, Enter takes the only thing left to take.
        if (inSearch && items.length === 1) {
          event.preventDefault();
          items[0].click();
        }
        return;
      case "Escape":
        event.preventDefault();
        return close();
      case "Tab":
        return close(false);
    }
  }

  const optionSize = sheet ? "py-3.5 text-base" : "py-2.5 text-sm";

  return (
    <>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${options.find((option) => option.value === value)?.label ?? ""}`}
        onClick={toggle}
        className={props.triggerClassName}
        style={props.triggerStyle}
      >
        {props.children}
      </button>

      {open &&
        createPortal(
          <>
            <div
              className={`fixed inset-0 z-30 ${sheet ? "animate-fade-in bg-black/45 motion-reduce:animate-none" : ""}`}
              onClick={() => close(false)}
              aria-hidden="true"
            />
            <div
              ref={list}
              onKeyDown={onKeyDown}
              style={sheet ? undefined : layout}
              className={`fixed z-40 flex flex-col overflow-hidden border border-border bg-surface text-foreground motion-reduce:animate-none ${
                sheet
                  ? "inset-x-0 bottom-0 max-h-[75dvh] animate-sheet-in rounded-t-3xl shadow-2xl"
                  : "animate-pop-in rounded-2xl shadow-xl shadow-black/15"
              }`}
            >
              {sheet && (
                <div className="shrink-0 px-5 pb-1 pt-3">
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
                  <p className="text-base font-semibold">{label}</p>
                </div>
              )}

              {searchable && (
                <label className={`relative block shrink-0 border-b border-border ${sheet ? "mx-3 mb-1 mt-2" : "mx-1.5 mt-1.5"}`}>
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted" />
                  <input
                    ref={search}
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={onCreate ? "Buscar ou criar…" : "Buscar…"}
                    aria-label={`Buscar em ${label}`}
                    aria-controls={listId}
                    autoComplete="off"
                    enterKeyHint="search"
                    maxLength={CREATE_MAX_LENGTH + 10}
                    // 16px on phones keeps iOS from zooming the page when the field is focused.
                    className="w-full bg-transparent py-2.5 pl-9 pr-3 text-base outline-none placeholder:text-muted sm:text-sm"
                  />
                </label>
              )}

              <div
                id={listId}
                role="listbox"
                aria-label={label}
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] ${
                  sheet ? "px-3 pb-[max(1rem,env(safe-area-inset-bottom))]" : "p-1.5"
                }`}
              >
                {visible.map((option) => {
                  const selected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => select(option.value)}
                      className={`${OPTION} ${optionSize} ${
                        selected
                          ? "bg-accent-soft font-semibold text-accent hover:bg-accent-soft focus-visible:bg-accent-soft"
                          : ""
                      }`}
                    >
                      {hasDots && (
                        <span
                          className={`size-3 shrink-0 rounded-full ${
                            option.color === null ? "border-2 border-dashed border-muted" : ""
                          }`}
                          style={option.color ? { backgroundColor: option.color } : undefined}
                          aria-hidden="true"
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {selected && <CheckIcon className="shrink-0 text-lg" />}
                    </button>
                  );
                })}

                {canCreate && (
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={create}
                    className={`${OPTION} ${optionSize} font-medium text-accent`}
                  >
                    <PlusIcon className="shrink-0 text-base" />
                    <span className="min-w-0 flex-1 truncate">Criar “{newName}”</span>
                  </button>
                )}

                {visible.length === 0 && !canCreate && (
                  <p className="px-3 py-4 text-center text-sm text-muted">Nenhum resultado.</p>
                )}
              </div>

              {footer && (
                <div className={`shrink-0 border-t border-border text-sm ${sheet ? "px-5 pb-4 pt-3" : "px-3 py-2.5"}`}>
                  {footer}
                </div>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

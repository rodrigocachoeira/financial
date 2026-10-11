"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckIcon } from "./icons";

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
const MENU_WIDTH = 232;
const MENU_MAX_HEIGHT = 400;

function anchorTo(trigger: HTMLElement): Layout {
  const rect = trigger.getBoundingClientRect();
  const minWidth = Math.max(rect.width, MENU_WIDTH);
  const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - minWidth - MARGIN));
  const below = window.innerHeight - rect.bottom - GAP - MARGIN;
  const above = rect.top - GAP - MARGIN;
  if (below < 220 && above > below) {
    return { left, minWidth, maxHeight: Math.min(MENU_MAX_HEIGHT, above), bottom: window.innerHeight - rect.top + GAP };
  }
  return { left, minWidth, maxHeight: Math.min(MENU_MAX_HEIGHT, below), top: rect.bottom + GAP };
}

/** A select whose list we draw ourselves, so it has room, colors and a phone-friendly sheet. */
export function SelectMenu(props: Props) {
  const { label, value, options, onChange, disabled, triggerClassName, triggerStyle, children } = props;
  const [layout, setLayout] = useState<Layout | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const open = layout !== null;
  const sheet = layout === "sheet";
  // When some options have a dot, the others keep the same indent.
  const hasDots = options.some((option) => option.color !== undefined);

  function close(returnFocus = true) {
    setLayout(null);
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

  // Focus the current option when the list opens.
  useEffect(() => {
    if (open) {
      const current = list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      (current ?? list.current?.querySelector<HTMLElement>('[role="option"]'))?.focus({ preventScroll: sheet });
      current?.scrollIntoView({ block: "nearest" });
    }
  }, [open, sheet]);

  // The floating list is anchored to a spot on screen: close it when that spot moves.
  // The sheet covers the page instead, so the page behind it is locked.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (sheet) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
    const dismiss = (event: Event) => {
      if (!(event.target instanceof Node) || !list.current?.contains(event.target)) {
        setLayout(null);
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
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focus = (target: number) => {
      event.preventDefault();
      items[(target + items.length) % items.length]?.focus();
    };
    switch (event.key) {
      case "ArrowDown":
        return focus(index + 1);
      case "ArrowUp":
        return focus(index - 1);
      case "Home":
        return focus(0);
      case "End":
        return focus(items.length - 1);
      case "Escape":
        event.preventDefault();
        return close();
      case "Tab":
        return close(false);
    }
  }

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
        className={triggerClassName}
        style={triggerStyle}
      >
        {children}
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
              id={listId}
              role="listbox"
              aria-label={label}
              onKeyDown={onKeyDown}
              style={sheet ? undefined : layout}
              className={`fixed z-40 overflow-y-auto overscroll-contain border border-border bg-surface text-foreground [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] motion-reduce:animate-none ${
                sheet
                  ? "inset-x-0 bottom-0 max-h-[75dvh] animate-sheet-in rounded-t-3xl px-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
                  : "animate-pop-in rounded-2xl p-1.5 shadow-xl shadow-black/15"
              }`}
            >
              {sheet && (
                <div className="sticky top-0 -mx-3 mb-1 bg-surface px-5 pb-2 pt-3">
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
                  <p className="text-base font-semibold">{label}</p>
                </div>
              )}
              {options.map((option) => {
                const selected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => select(option.value)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 text-left outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted ${
                      sheet ? "py-3.5 text-base" : "py-2.5 text-sm"
                    } ${selected ? "bg-accent-soft font-semibold text-accent hover:bg-accent-soft focus-visible:bg-accent-soft" : ""}`}
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
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

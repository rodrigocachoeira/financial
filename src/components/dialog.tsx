"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** A modal on the native <dialog>, which traps focus and closes with Esc by itself. */
export function Dialog({ open, onClose, title, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself, not on its content.
      onClick={(event) => {
        if (event.target === dialog.current) {
          onClose();
        }
      }}
      aria-label={title}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/45 open:animate-pop-in motion-reduce:animate-none"
    >
      {open && (
        <div className="flex flex-col gap-4 p-5">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}

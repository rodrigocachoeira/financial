"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AlertIcon, CheckIcon } from "./icons";

interface Toast {
  id: number;
  ok: boolean;
  message: string;
}

const ToastContext = createContext<(toast: Omit<Toast, "id">) => void>(() => {});

const VISIBLE_MS = 4500;

/** Shows short confirmations at the bottom of the screen. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const show = useCallback((next: Omit<Toast, "id">) => setToast({ ...next, id: Date.now() }), []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
        {toast && (
          <p
            key={toast.id}
            className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              toast.ok ? "bg-foreground text-background" : "bg-negative text-white"
            }`}
          >
            {toast.ok ? <CheckIcon className="shrink-0 text-base" /> : <AlertIcon className="shrink-0 text-base" />}
            <span className="min-w-0 break-words">{toast.message}</span>
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/reports", label: "Mês" },
  { href: "/reports/budget", label: "Orçamento" },
  { href: "/reports/year", label: "Ano" },
  { href: "/reports/subscriptions", label: "Recorrentes" },
];

/** The views of the reports. They share the page header, so they are tabs and not menu entries. */
export function ReportTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Visões dos relatórios" className="flex gap-1 overflow-x-auto rounded-xl bg-surface-muted p-1">
      {TABS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-sm font-medium transition-colors sm:flex-none sm:px-4 ${
              active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/reports", label: "Relatórios" },
  { href: "/transactions", label: "Transações" },
  { href: "/import", label: "Importar" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors sm:px-3 sm:text-sm ${
              active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}

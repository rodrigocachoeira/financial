import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/icons";
import { SignOutButton } from "@/components/sign-out-button";
import { ToastProvider } from "@/components/toast";
import { skeleton } from "@/components/ui";
import { requireSession } from "@/server/auth/session";
import { NavLinks } from "./nav-links";

async function Account() {
  const session = await requireSession();
  return (
    <div className="flex items-center gap-1">
      <span className="hidden max-w-48 truncate text-sm text-muted md:inline">{session.email}</span>
      <SignOutButton />
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <header className="sticky top-0 z-10 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-4 py-2.5">
          <nav className="flex items-center gap-1">
            <Link href="/transactions" className="mr-1 flex items-center gap-2 sm:mr-3" aria-label="Financial">
              <Logo className="size-8 text-sm" />
              <span className="hidden font-semibold tracking-tight sm:inline">Financial</span>
            </Link>
            <NavLinks />
          </nav>
          <Suspense fallback={<div className={`${skeleton} h-8 w-20`} />}>
            <Account />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </ToastProvider>
  );
}

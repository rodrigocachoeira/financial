import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { requireSession } from "@/server/auth/session";

async function Account() {
  const session = await requireSession();
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-zinc-500 sm:inline">{session.email}</span>
      <SignOutButton />
    </div>
  );
}

const NAV_LINK = "rounded-md px-2 py-1 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <nav className="flex items-center gap-1">
            <Link href="/transactions" className="mr-2 font-semibold tracking-tight">
              Financial
            </Link>
            <Link href="/transactions" className={NAV_LINK}>
              Transações
            </Link>
            <Link href="/import" className={NAV_LINK}>
              Importar
            </Link>
          </nav>
          <Suspense>
            <Account />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}

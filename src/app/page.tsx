import { Suspense } from "react";
import { requireSession } from "@/server/auth/session";
import { SignOutButton } from "./sign-out-button";

async function Account() {
  const session = await requireSession();
  return (
    <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
      <span>{session.email}</span>
      <SignOutButton />
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Financial</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Importe seus extratos do Nubank e veja para onde vai o seu dinheiro.
      </p>
      <Suspense>
        <Account />
      </Suspense>
    </main>
  );
}

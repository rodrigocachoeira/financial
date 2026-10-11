import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertIcon, Logo } from "@/components/icons";
import { card } from "@/components/ui";
import { SignInButton } from "./sign-in-button";

export const metadata: Metadata = { title: "Entrar | Financial" };

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "Esta conta não tem acesso a esta aplicação.",
};
const DEFAULT_ERROR = "Não foi possível entrar. Tente novamente.";

async function LoginError({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  if (typeof error !== "string") {
    return null;
  }
  return (
    <p role="alert" className="flex items-center gap-2 rounded-xl bg-negative-soft px-4 py-3 text-left text-sm text-negative">
      <AlertIcon className="shrink-0 text-base" />
      {ERROR_MESSAGES[error] ?? DEFAULT_ERROR}
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-accent-soft/70 to-background p-4">
      <div className={`${card} flex w-full max-w-sm flex-col items-center gap-6 px-6 py-10 text-center shadow-xl shadow-accent/10`}>
        <Logo className="size-14 text-2xl" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financial</h1>
          <p className="mt-2 text-sm text-muted">Veja para onde vai o seu dinheiro, a partir dos extratos do Nubank.</p>
        </div>
        <SignInButton />
        <Suspense>
          <LoginError searchParams={searchParams} />
        </Suspense>
        <p className="text-xs text-muted">Acesso restrito ao proprietário.</p>
      </div>
    </main>
  );
}

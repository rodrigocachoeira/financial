import type { Metadata } from "next";
import { Suspense } from "react";
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
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {ERROR_MESSAGES[error] ?? DEFAULT_ERROR}
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Financial</h1>
      <p className="text-zinc-600 dark:text-zinc-400">Acesso restrito ao proprietário.</p>
      <SignInButton />
      <Suspense>
        <LoginError searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

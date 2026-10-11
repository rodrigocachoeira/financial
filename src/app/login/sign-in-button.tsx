"use client";

import { signIn } from "next-auth/react";

export function SignInButton() {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: "/" })}
      className="rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-85"
    >
      Entrar com Google
    </button>
  );
}

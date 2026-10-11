"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { GoogleIcon, Spinner } from "@/components/icons";
import { buttonSecondary } from "@/components/ui";

export function SignInButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signIn("google", { callbackUrl: "/" });
      }}
      className={`${buttonSecondary} w-full py-3 text-base shadow-sm`}
    >
      {pending ? <Spinner className="text-accent" /> : <GoogleIcon className="text-lg" />}
      {pending ? "Redirecionando…" : "Entrar com Google"}
    </button>
  );
}

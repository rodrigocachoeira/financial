"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { LogOutIcon, Spinner } from "./icons";
import { buttonGhost } from "./ui";

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signOut({ callbackUrl: "/login" });
      }}
      className={buttonGhost}
    >
      {pending ? <Spinner /> : <LogOutIcon />}
      <span className="sr-only sm:not-sr-only">Sair</span>
    </button>
  );
}

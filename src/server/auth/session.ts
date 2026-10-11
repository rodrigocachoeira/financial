import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { isAllowedEmail } from "@/lib/auth/access";
import { getAuthOptions } from "./options";

export interface AppSession {
  email: string;
}

/** Session of the current request, or null. Use in route handlers, which answer 401. */
export const getSession = cache(async (): Promise<AppSession | null> => {
  // Request-time only: keeps session reads, and their configuration checks, out of prerendering.
  await connection();
  const session = await getServerSession(getAuthOptions());
  const email = session?.user?.email;
  // Checked again here so a session outlives neither a change of the allowed address nor a proxy bypass.
  if (!email || !isAllowedEmail(email, true, process.env.AUTH_ALLOWED_EMAIL)) {
    return null;
  }
  return { email };
});

/** Session of the current request; redirects to the login page when there is none. Use in pages. */
export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

import type { NextAuthOptions } from "next-auth";
import GoogleProvider, { type GoogleProfile } from "next-auth/providers/google";
import { isAllowedEmail } from "@/lib/auth/access";

export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

/** Built per request so a missing variable fails loudly instead of opening access. */
export function getAuthOptions(): NextAuthOptions {
  const allowedEmail = requiredEnv("AUTH_ALLOWED_EMAIL");

  return {
    secret: requiredEnv("NEXTAUTH_SECRET"),
    providers: [
      GoogleProvider({
        clientId: requiredEnv("GOOGLE_CLIENT_ID"),
        clientSecret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      }),
    ],
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
    pages: { signIn: "/login", error: "/login" },
    callbacks: {
      signIn({ account, profile }) {
        const google = profile as GoogleProfile | undefined;
        return (
          account?.provider === "google" &&
          isAllowedEmail(google?.email, google?.email_verified === true, allowedEmail)
        );
      },
    },
  };
}

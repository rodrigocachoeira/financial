const normalize = (email: string | null | undefined) => email?.trim().toLowerCase() ?? "";

/** Only the single configured address gets in, and only when the provider verified it. */
export function isAllowedEmail(
  email: string | null | undefined,
  emailVerified: boolean,
  allowedEmail: string | undefined,
): boolean {
  const allowed = normalize(allowedEmail);
  return emailVerified && allowed !== "" && normalize(email) === allowed;
}

const PUBLIC_PATHS = ["/login", "/favicon.ico"];
const PUBLIC_PREFIXES = ["/api/auth/", "/_next/"];

/** Everything is protected unless listed here. */
export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname === "/api/auth" ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail, isPublicPath } from "@/lib/auth/access";

// Optimistic check on every request. Data access re-validates with requireSession/getSession.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret ? await getToken({ req: request, secret }) : null;
  const authenticated = isAllowedEmail(token?.email, true, process.env.AUTH_ALLOWED_EMAIL);

  if (authenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (authenticated || isPublicPath(pathname)) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

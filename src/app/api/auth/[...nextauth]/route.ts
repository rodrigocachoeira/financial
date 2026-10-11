import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { getAuthOptions } from "@/server/auth/options";

type RouteContext = { params: Promise<{ nextauth: string[] }> };

function handler(request: NextRequest, context: RouteContext) {
  return NextAuth(request, context, getAuthOptions());
}

export { handler as GET, handler as POST };

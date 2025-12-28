import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// exact public routes
const EXACT_PUBLIC = ["/"];

// prefix public routes
const PREFIX_PUBLIC = [
  "/auth",
  "/api/auth",
  "/_next",
  "/favicon.ico",
];

const TOKEN_API = ["/api/ask", "/api/ingest"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // exact allow
  if (EXACT_PUBLIC.includes(pathname)) {
    return NextResponse.next();
  }

  // prefix allow
  if (PREFIX_PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // token-protected API endpoints
  if (TOKEN_API.some((p) => pathname.startsWith(p))) {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing API token" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // session check
  const session = await getToken({ req });
  if (!session) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};

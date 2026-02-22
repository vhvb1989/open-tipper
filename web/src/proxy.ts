import { NextResponse } from "next/server";

/**
 * Minimal proxy / middleware.
 *
 * Authentication is handled entirely by the NextAuth.js route handler and
 * server-side `auth()` calls in individual pages/routes. The proxy just
 * passes requests through — no session decoding needed here.
 */
export default function proxy() {
  return NextResponse.next();
}

export const config = {
  // Match all routes except static files, images, and Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

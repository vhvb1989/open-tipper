/**
 * Admin authorization helper.
 *
 * Usage in API routes:
 *   const session = await requireAdmin();
 *   // if we reach here, user is authenticated & has ADMIN role
 */

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  if (session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

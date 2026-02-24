"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

export function NavBar() {
  const { data: session, status } = useSession();

  return (
    <nav className="border-b border-navy-700/30 bg-navy-800">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-gold-400"
        >
          Open Tipper
        </Link>

        <div className="flex items-center gap-4">
          {status === "loading" && (
            <div className="h-8 w-8 animate-pulse rounded-full bg-navy-700" />
          )}

          {status === "unauthenticated" && (
            <div className="flex items-center gap-3">
              <Link
                href="/groups/browse"
                className="text-sm text-navy-200 transition-colors hover:text-white"
              >
                Browse
              </Link>
              <Link
                href="/signin"
                className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-navy-900 transition-colors hover:bg-gold-400"
              >
                Sign in
              </Link>
            </div>
          )}

          {status === "authenticated" && session?.user && (
            <div className="flex items-center gap-3">
              <Link
                href="/groups/browse"
                className="text-sm text-navy-200 transition-colors hover:text-white"
              >
                Browse
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-navy-200 transition-colors hover:text-white"
              >
                My Groups
              </Link>
              {(session.user as { role?: string }).role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="text-sm text-gold-400 transition-colors hover:text-gold-300"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/profile"
                className="flex items-center gap-2 text-sm text-navy-200 transition-colors hover:text-white"
              >
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name ?? "User avatar"}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-700 text-xs font-medium text-navy-200">
                    {(session.user.name ?? session.user.email ?? "U")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline">
                  {session.user.name ?? session.user.email}
                </span>
              </Link>

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-lg border border-navy-600 px-3 py-1.5 text-sm text-navy-200 transition-colors hover:bg-navy-700"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

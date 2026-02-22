import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const groups = await prisma.group.findMany({
    where: {
      memberships: {
        some: { userId: session.user.id },
      },
    },
    include: {
      contest: {
        select: { name: true, code: true, season: true, emblem: true },
      },
      _count: { select: { memberships: true } },
      memberships: {
        where: { userId: session.user.id },
        select: { role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            My Groups
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {groups.length === 0
              ? "You haven't joined any groups yet."
              : `${groups.length} group${groups.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href="/groups/create"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Create group
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-8 py-16 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Create a group to start predicting scores with your friends.
          </p>
          <Link
            href="/groups/create"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Create your first group
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="group rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {group.name}
                  </h2>
                  {group.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {group.description}
                    </p>
                  )}
                </div>
                {group.memberships[0]?.role === "ADMIN" && (
                  <span className="ml-2 shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    Admin
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-4.5A3.375 3.375 0 0 0 13.125 10.875h-2.25A3.375 3.375 0 0 0 7.5 14.25v4.5m9 0H7.5" />
                  </svg>
                  {group._count.memberships} member{group._count.memberships === 1 ? "" : "s"}
                </span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium dark:bg-zinc-800">
                  {group.contest.code}
                </span>
                <span>{group.contest.name} {group.contest.season}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

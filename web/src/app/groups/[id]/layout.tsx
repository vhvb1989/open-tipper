import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { GroupTabs } from "@/components/GroupTabs";

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const { id } = await params;

  const group = await prisma.group.findUnique({
    where: { id },
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
  });

  if (!group) {
    notFound();
  }

  const userRole = group.memberships[0]?.role ?? null;

  // Private group: only members can see
  if (group.visibility === "PRIVATE" && !userRole) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          My Groups
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {group.name}
        </h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium dark:bg-zinc-800">
            {group.contest.code}
          </span>
          <span>{group.contest.name} {group.contest.season}</span>
          <span>·</span>
          <span>{group._count.memberships} member{group._count.memberships === 1 ? "" : "s"}</span>
          {userRole && (
            <>
              <span>·</span>
              <span className="capitalize">{userRole.toLowerCase()}</span>
            </>
          )}
        </div>
        {group.description && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {group.description}
          </p>
        )}
      </div>

      {/* Tabs */}
      <GroupTabs groupId={id} isAdmin={userRole === "ADMIN"} isMember={!!userRole} />

      {/* Tab content */}
      <div className="mt-6">{children}</div>
    </div>
  );
}

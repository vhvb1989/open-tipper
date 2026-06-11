import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { GroupTabs } from "@/components/GroupTabs";
import { JoinGroupButton } from "@/components/JoinGroupButton";
import { LiveProvider } from "@/components/LiveProvider";
import { getLocale } from "@/i18n/server";
import { getT } from "@/i18n";

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const { id } = await params;

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      contest: {
        select: { name: true, code: true, season: true, emblem: true },
      },
      podiumSettings: { select: { enabled: true } },
      _count: { select: { memberships: true } },
      ...(userId
        ? {
            memberships: {
              where: { userId },
              select: { role: true },
            },
          }
        : { memberships: { where: { role: "ADMIN" }, take: 0, select: { role: true } } }),
    },
  });

  if (!group) {
    notFound();
  }

  const userRole = userId ? (group.memberships[0]?.role ?? null) : null;
  const isMember = !!userRole;

  // Private group: only members can see
  if (group.visibility === "PRIVATE" && !isMember) {
    notFound();
  }

  const locale = await getLocale();
  const t = getT(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={isMember ? "/dashboard" : "/groups/browse"}
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          {isMember ? t("groupPage.myGroups") : t("groupPage.browseGroups")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {group.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium dark:bg-zinc-800">
                {group.contest.code}
              </span>
              <span>
                {group.contest.name} {group.contest.season}
              </span>
              <span>·</span>
              <span>{t("groupPage.memberCount", { count: group._count.memberships })}</span>
              {group.visibility === "PUBLIC" && (
                <>
                  <span>·</span>
                  <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {t("groupPage.publicBadge")}
                  </span>
                </>
              )}
              {userRole && (
                <>
                  <span>·</span>
                  <span className="capitalize">{userRole.toLowerCase()}</span>
                </>
              )}
            </div>
            {group.description && (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{group.description}</p>
            )}
          </div>

          {/* Join button for non-members on public groups */}
          {!isMember && group.visibility === "PUBLIC" && (
            <JoinGroupButton groupId={id} isAuthenticated={!!userId} />
          )}
        </div>
      </div>

      {/* Tabs */}
      <GroupTabs
        groupId={id}
        isAdmin={userRole === "ADMIN"}
        isMember={isMember}
        hasPodium={!!group.podiumSettings?.enabled}
      />

      {/* Tab content — wrapped with LiveProvider for real-time updates */}
      <LiveProvider contestIds={[group.contestId]}>
        <div className="mt-6">{children}</div>
      </LiveProvider>
    </div>
  );
}

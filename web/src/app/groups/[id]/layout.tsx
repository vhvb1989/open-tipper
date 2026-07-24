import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { GroupTabs } from "@/components/GroupTabs";
import { JoinGroupButton } from "@/components/JoinGroupButton";
import { NewSeasonButton } from "@/components/NewSeasonButton";
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
        select: { name: true, code: true, season: true, emblem: true, status: true },
      },
      previousGroup: { select: { id: true } },
      nextGroups: { select: { id: true }, take: 1 },
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
  const isAdmin = userRole === "ADMIN";
  const isArchived = group.contest.status === "COMPLETED";
  const nextGroup = group.nextGroups[0] ?? null;

  // Admins can start a new season only when a current (non-completed) contest
  // exists for the same league and this group hasn't been rolled over yet.
  let canStartNewSeason = false;
  if (isAdmin && !nextGroup) {
    const target = await prisma.contest.findFirst({
      where: {
        code: group.contest.code,
        status: { not: "COMPLETED" },
        id: { not: group.contestId },
      },
      select: { id: true },
    });
    canStartNewSeason = !!target;
  }

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
              {isArchived && (
                <>
                  <span>·</span>
                  <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {t("seasonRollover.archivedBadge")}
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
            {(group.previousGroup || nextGroup) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {group.previousGroup && (
                  <Link
                    href={`/groups/${group.previousGroup.id}`}
                    className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {t("seasonRollover.seePreviousSeason")}
                  </Link>
                )}
                {nextGroup && (
                  <Link
                    href={`/groups/${nextGroup.id}`}
                    className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {t("seasonRollover.seeCurrentSeason")}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Actions: join (non-members) or start-new-season (archived admins) */}
          <div className="flex flex-col items-end gap-2">
            {!isMember && group.visibility === "PUBLIC" && (
              <JoinGroupButton groupId={id} isAuthenticated={!!userId} />
            )}
            {canStartNewSeason && <NewSeasonButton groupId={id} />}
          </div>
        </div>
      </div>

      {/* Read-only archive banner */}
      {isArchived && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
          {t("seasonRollover.archivedBanner")}
        </div>
      )}

      {/* Tabs */}
      <GroupTabs
        groupId={id}
        isAdmin={userRole === "ADMIN"}
        isMember={isMember}
        riskEnabled={group.riskEnabled}
      />

      {/* Tab content — wrapped with LiveProvider for real-time updates */}
      <LiveProvider contestIds={[group.contestId]}>
        <div className="mt-6">{children}</div>
      </LiveProvider>
    </div>
  );
}

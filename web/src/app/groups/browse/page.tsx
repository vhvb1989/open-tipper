"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/Footer";
import { useTranslation } from "@/i18n/TranslationProvider";

interface Contest {
  id: string;
  name: string;
  code: string;
  season: string;
}

interface GroupAdmin {
  id: string;
  name: string | null;
  image: string | null;
}

interface BrowseGroup {
  id: string;
  name: string;
  description: string | null;
  contest: Contest & { emblem: string | null };
  memberCount: number;
  admin: GroupAdmin | null;
  isMember: boolean;
  createdAt: string;
}

export default function BrowseGroupsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [groups, setGroups] = useState<BrowseGroup[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [search, setSearch] = useState("");
  const [contestFilter, setContestFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const { t } = useTranslation();

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (contestFilter) params.set("contestId", contestFilter);
      const res = await fetch(`/api/groups/browse?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load groups");
      const data = await res.json();
      setGroups(data.groups);
      setContests(data.contests);
    } catch {
      setError("Failed to load public groups. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [search, contestFilter]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleJoin = async (groupId: string) => {
    if (authStatus !== "authenticated") {
      router.push("/signin");
      return;
    }
    setJoiningId(groupId);
    setJoinError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          // Already a member — navigate to the group
          router.push(`/groups/${groupId}`);
          return;
        }
        throw new Error(data.error || "Failed to join group");
      }
      setJoinedIds((prev) => new Set(prev).add(groupId));
      router.push(`/groups/${groupId}`);
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : "Failed to join group"
      );
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {t("browse.heading")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t("browse.description")}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="search" className="sr-only">
              Search groups
            </label>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <input
                id="search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("browse.searchPlaceholder")}
                className="block w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </div>
          </div>
          <div className="sm:w-56">
            <label htmlFor="contestFilter" className="sr-only">
              Filter by competition
            </label>
            <select
              id="contestFilter"
              value={contestFilter}
              onChange={(e) => setContestFilter(e.target.value)}
              className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">{t("browse.allCompetitions")}</option>
              {contests.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.season})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
            <button
              onClick={fetchGroups}
              className="ml-2 font-medium underline hover:no-underline"
            >
              {t("browse.retry")}
            </button>
          </div>
        )}

        {/* Join error */}
        {joinError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {joinError}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="h-5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="mt-2 h-4 w-1/2 rounded bg-zinc-100 dark:bg-zinc-800" />
                <div className="mt-4 h-4 w-2/3 rounded bg-zinc-100 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && groups.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 px-8 py-16 text-center dark:border-zinc-700">
            <svg
              className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
              />
            </svg>
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              {search || contestFilter
                ? t("browse.noMatchFilters")
                : t("browse.noGroupsYet")}
            </p>
            {(search || contestFilter) && (
              <button
                onClick={() => {
                  setSearch("");
                  setContestFilter("");
                }}
                className="mt-3 text-sm font-medium text-gold-600 hover:text-gold-500 dark:text-gold-400 dark:hover:text-gold-300"
              >
                {t("browse.clearFilters")}
              </button>
            )}
            {authStatus === "authenticated" && (
              <Link
                href="/groups/create"
                className="mt-4 inline-block rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-navy-900 transition-colors hover:bg-gold-400"
              >
                {t("browse.createPublicGroup")}
              </Link>
            )}
          </div>
        )}

        {/* Group cards */}
        {!loading && groups.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                {/* Top: name + description */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      {group.name}
                    </h2>
                    <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {t("groupPage.publicBadge")}
                    </span>
                  </div>
                  {group.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {group.description}
                    </p>
                  )}
                </div>

                {/* Meta info */}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium dark:bg-zinc-800">
                    {group.contest.code}
                  </span>
                  <span>
                    {group.contest.name} {group.contest.season}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                      />
                    </svg>
                    {t("groupPage.memberCount", { count: group.memberCount })}
                  </span>
                  {group.admin && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        {group.admin.image ? (
                          <Image
                            src={group.admin.image}
                            alt=""
                            width={14}
                            height={14}
                            className="rounded-full"
                          />
                        ) : null}
                        {group.admin.name ?? t("browse.admin")}
                      </span>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/groups/${group.id}/standings`}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    {t("browse.viewStandings")}
                  </Link>
                  {group.isMember || joinedIds.has(group.id) ? (
                    <Link
                      href={`/groups/${group.id}`}
                      className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    >
                      {t("browse.joined")}
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleJoin(group.id)}
                      disabled={joiningId === group.id}
                      className="rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-medium text-navy-900 transition-colors hover:bg-gold-400 disabled:opacity-50"
                    >
                      {joiningId === group.id ? t("browse.joining") : t("browse.joinGroup")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

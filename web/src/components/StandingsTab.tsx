"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useLive } from "./LiveProvider";
import BadgePopover from "./BadgePopover";
import { useTranslation } from "@/i18n/TranslationProvider";
import type { Round } from "@/lib/rounds";

/* ---------- Types ---------- */

interface MedalEntry {
  matchDay: number;
  points: number;
}

interface PodiumBadgeEntry {
  position: "FIRST" | "SECOND" | "THIRD";
  points: number;
}

interface PodiumTeam {
  id: string;
  name: string;
  crest: string | null;
}

interface PodiumPicks {
  firstPlaceTeam: PodiumTeam | null;
  secondPlaceTeam: PodiumTeam | null;
  thirdPlaceTeam: PodiumTeam | null;
}

interface StandingEntry {
  rank: number;
  userId: string;
  userName: string | null;
  userImage: string | null;
  role: string;
  totalPoints: number;
  totalBonusPoints: number;
  predictionsScored: number;
  lastRoundPoints: number;
  medals: MedalEntry[];
  podiumBadges?: PodiumBadgeEntry[];
  podiumPicks?: PodiumPicks | null;
}

type SortField = "totalPoints" | "lastRoundPoints";

/* Podium badge display config */
function podiumBadgeConfig(position: "FIRST" | "SECOND" | "THIRD") {
  if (position === "FIRST") {
    return {
      emoji: "🥇",
      label: "1P",
      titleKey: "podium.badge1PTitle",
      descKey: "podium.badge1PDesc",
      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    };
  }
  if (position === "SECOND") {
    return {
      emoji: "🥈",
      label: "2P",
      titleKey: "podium.badge2PTitle",
      descKey: "podium.badge2PDesc",
      color: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
    };
  }
  return {
    emoji: "🥉",
    label: "3P",
    titleKey: "podium.badge3PTitle",
    descKey: "podium.badge3PDesc",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };
}

/* ---------- Component ---------- */

export default function StandingsTab({
  groupId,
  currentUserId,
}: {
  groupId: string;
  currentUserId: string;
}) {
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundKey, setSelectedRoundKey] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortField>("totalPoints");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { scoresVersion } = useLive();
  const { t } = useTranslation();

  const fetchStandings = useCallback(
    async (round?: Round | null) => {
      setLoading(true);
      try {
        let url = `/api/groups/${groupId}/standings`;
        if (round?.type === "matchDay" && round.matchDay != null) {
          url += `?matchDay=${round.matchDay}`;
        } else if (round?.type === "playoff" && round.stage) {
          url += `?stage=${encodeURIComponent(round.stage)}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch standings");
        const data = await res.json();
        setStandings(data.standings);
        if (data.rounds) setRounds(data.rounds);
        if (selectedRoundKey === null && data.selectedRoundKey != null) {
          setSelectedRoundKey(data.selectedRoundKey);
        }
      } catch (err) {
        console.error("Failed to load standings:", err);
        setError("Failed to load standings. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [groupId, selectedRoundKey],
  );

  useEffect(() => {
    fetchStandings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh when predictions are scored (via SSE)
  useEffect(() => {
    if (scoresVersion > 0) {
      const round = rounds.find((r) => r.key === selectedRoundKey) ?? null;
      fetchStandings(round);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoresVersion]);

  const handleRoundChange = (round: Round) => {
    setSelectedRoundKey(round.key);
    fetchStandings(round);
  };

  const toggleSort = (field: SortField) => {
    setSortBy(field);
  };

  // Sort standings client-side based on selected sort field
  const sortedStandings = [...standings].sort((a, b) => {
    const primary = b[sortBy] - a[sortBy];
    if (primary !== 0) return primary;
    // Tiebreaker: the other column
    const secondary =
      sortBy === "totalPoints"
        ? b.lastRoundPoints - a.lastRoundPoints
        : b.totalPoints - a.totalPoints;
    return secondary;
  });

  // Re-rank after sorting
  const rankedStandings = sortedStandings.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));

  /* ---- Render ---- */

  if (loading && standings.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
      </div>
    );
  }

  if (standings.length === 0 && !loading) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 px-8 py-16 text-center dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {t("standings.noStandings")}
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t("standings.noStandingsDesc")}
        </p>
      </div>
    );
  }

  const sortIndicator = (field: SortField) => (sortBy === field ? " ▼" : "");

  // Show bonus column if any player has bonus points
  const hasBonusPoints = standings.some((s) => (s.totalBonusPoints ?? 0) > 0);

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button
            onClick={() => {
              setError(null);
              const round = rounds.find((r) => r.key === selectedRoundKey) ?? null;
              fetchStandings(round);
            }}
            className="ml-2 underline"
          >
            {t("standings.retry")}
          </button>
        </div>
      )}

      {/* Round filter */}
      {rounds.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t("standings.lastRound")}
          </label>
          <select
            value={selectedRoundKey ?? ""}
            onChange={(e) => {
              const round = rounds.find((r) => r.key === e.target.value);
              if (round) handleRoundChange(round);
            }}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {rounds.map((r) => (
              <option key={r.key} value={r.key}>
                {r.type === "matchDay" ? t("standings.matchDay", { n: r.matchDay ?? 0 }) : r.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Mobile card layout */}
      <div className="space-y-2 md:hidden">
        {/* Sort buttons */}
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => toggleSort("totalPoints")}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              sortBy === "totalPoints"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {t("standings.pointsHeader")}
            {sortIndicator("totalPoints")}
          </button>
          <button
            onClick={() => toggleSort("lastRoundPoints")}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              sortBy === "lastRoundPoints"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {t("standings.lastRoundHeader")}
            {sortIndicator("lastRoundPoints")}
          </button>
        </div>

        {rankedStandings.map((entry) => {
          const isCurrentUser = entry.userId === currentUserId;
          return (
            <div
              key={entry.userId}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${
                isCurrentUser
                  ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/10"
                  : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/30"
              }`}
            >
              {/* Rank */}
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  entry.rank === 1
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : entry.rank === 2
                      ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                      : entry.rank === 3
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                        : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {entry.rank}
              </span>

              {/* Avatar */}
              {entry.userImage ? (
                <Image
                  src={entry.userImage}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 shrink-0 rounded-full"
                  unoptimized
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  {(entry.userName ?? "?")[0]?.toUpperCase()}
                </div>
              )}

              {/* Name + podium picks + badges */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span
                    className={`truncate text-sm font-medium ${
                      isCurrentUser
                        ? "text-blue-700 dark:text-blue-400"
                        : "text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {entry.userName ?? t("standings.unknown")}
                  </span>
                  {isCurrentUser && (
                    <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                      {t("standings.you")}
                    </span>
                  )}
                </div>
                {/* Podium team picks */}
                {entry.podiumPicks && (
                  <div className="mt-1 flex items-center gap-1">
                    {[
                      entry.podiumPicks.firstPlaceTeam,
                      entry.podiumPicks.secondPlaceTeam,
                      entry.podiumPicks.thirdPlaceTeam,
                    ]
                      .filter(Boolean)
                      .map((team) => (
                        <div key={team!.id} title={team!.name}>
                          {team!.crest ? (
                            <Image
                              src={team!.crest}
                              alt={team!.name}
                              width={20}
                              height={20}
                              className="h-5 w-5 rounded-full border border-white dark:border-zinc-900"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-zinc-200 text-[8px] font-bold text-zinc-500 dark:border-zinc-900 dark:bg-zinc-700 dark:text-zinc-400">
                              {team!.name[0]}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
                {/* Medals & podium badges */}
                {(entry.medals.length > 0 ||
                  (entry.podiumBadges && entry.podiumBadges.length > 0)) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {entry.medals.map((medal) => (
                      <BadgePopover
                        key={medal.matchDay}
                        title={t("standings.medalTitle", { n: medal.matchDay })}
                        description={t("standings.medalDesc", {
                          n: medal.matchDay,
                          pts: medal.points,
                        })}
                        points={`+${medal.points} pts`}
                        badge={
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            🏅{medal.matchDay}
                          </span>
                        }
                      />
                    ))}
                    {entry.podiumBadges?.map((badge) => {
                      const config = podiumBadgeConfig(badge.position);
                      return (
                        <BadgePopover
                          key={badge.position}
                          title={t(config.titleKey)}
                          description={t(config.descKey)}
                          points={`+${badge.points} pts`}
                          badge={
                            <span
                              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${config.color}`}
                            >
                              {config.emoji}
                              {config.label}
                            </span>
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Points column */}
              <div className="shrink-0 text-right">
                <div
                  className={`text-lg font-bold ${sortBy === "totalPoints" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  {entry.totalPoints}
                </div>
                <div
                  className={`text-xs ${sortBy === "lastRoundPoints" ? "font-bold text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  {entry.lastRoundPoints > 0 ? `+${entry.lastRoundPoints}` : "0"}
                </div>
                {hasBonusPoints && (entry.totalBonusPoints ?? 0) > 0 && (
                  <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    +{entry.totalBonusPoints}★
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table layout */}
      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 md:block dark:border-zinc-700">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
              <th className="w-12 px-4 py-3 text-center">{t("standings.rank")}</th>
              <th className="px-4 py-3">{t("standings.player")}</th>
              <th className="w-24 px-4 py-3 text-right">
                <button
                  onClick={() => toggleSort("totalPoints")}
                  className={`transition-colors ${sortBy === "totalPoints" ? "text-zinc-900 dark:text-zinc-100" : "hover:text-zinc-700 dark:hover:text-zinc-300"}`}
                >
                  {t("standings.pointsHeader")}
                  {sortIndicator("totalPoints")}
                </button>
              </th>
              <th className="w-24 px-4 py-3 text-right">
                <button
                  onClick={() => toggleSort("lastRoundPoints")}
                  className={`transition-colors ${sortBy === "lastRoundPoints" ? "text-zinc-900 dark:text-zinc-100" : "hover:text-zinc-700 dark:hover:text-zinc-300"}`}
                >
                  {t("standings.lastRoundHeader")}
                  {sortIndicator("lastRoundPoints")}
                </button>
              </th>
              {hasBonusPoints && (
                <th className="w-20 px-4 py-3 text-right">
                  <span className="text-amber-600 dark:text-amber-400">
                    {t("standings.bonusHeader")}
                  </span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rankedStandings.map((entry) => {
              const isCurrentUser = entry.userId === currentUserId;
              return (
                <tr
                  key={entry.userId}
                  className={`transition-colors ${
                    isCurrentUser
                      ? "bg-blue-50/50 dark:bg-blue-900/10"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                  }`}
                >
                  {/* Rank */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                        entry.rank === 1
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : entry.rank === 2
                            ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                            : entry.rank === 3
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                              : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {entry.rank}
                    </span>
                  </td>

                  {/* Player */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Podium team crests */}
                      {entry.podiumPicks && (
                        <div className="flex -space-x-1" title={t("podium.heading")}>
                          {[
                            entry.podiumPicks.firstPlaceTeam,
                            entry.podiumPicks.secondPlaceTeam,
                            entry.podiumPicks.thirdPlaceTeam,
                          ]
                            .filter(Boolean)
                            .map((team, i) => (
                              <div
                                key={team!.id}
                                className="relative"
                                style={{ zIndex: 3 - i }}
                                title={team!.name}
                              >
                                {team!.crest ? (
                                  <Image
                                    src={team!.crest}
                                    alt={team!.name}
                                    width={20}
                                    height={20}
                                    className="h-5 w-5 rounded-full border border-white dark:border-zinc-900"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-zinc-200 text-[8px] font-bold text-zinc-500 dark:border-zinc-900 dark:bg-zinc-700 dark:text-zinc-400">
                                    {team!.name[0]}
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                      {entry.userImage ? (
                        <Image
                          src={entry.userImage}
                          alt=""
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-full"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                          {(entry.userName ?? "?")[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-sm font-medium ${
                              isCurrentUser
                                ? "text-blue-700 dark:text-blue-400"
                                : "text-zinc-900 dark:text-zinc-100"
                            }`}
                          >
                            {entry.userName ?? t("standings.unknown")}
                            {isCurrentUser && (
                              <span className="ml-1 text-xs text-zinc-400 dark:text-zinc-500">
                                {t("standings.you")}
                              </span>
                            )}
                          </span>
                        </div>
                        {(entry.medals.length > 0 ||
                          (entry.podiumBadges && entry.podiumBadges.length > 0)) && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {entry.medals.map((medal) => (
                              <BadgePopover
                                key={medal.matchDay}
                                title={t("standings.medalTitle", {
                                  n: medal.matchDay,
                                })}
                                description={t("standings.medalDesc", {
                                  n: medal.matchDay,
                                  pts: medal.points,
                                })}
                                points={`+${medal.points} pts`}
                                badge={
                                  <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    🏅{medal.matchDay}
                                  </span>
                                }
                              />
                            ))}
                            {entry.podiumBadges?.map((badge) => {
                              const config = podiumBadgeConfig(badge.position);
                              return (
                                <BadgePopover
                                  key={badge.position}
                                  title={t(config.titleKey)}
                                  description={t(config.descKey)}
                                  points={`+${badge.points} pts`}
                                  badge={
                                    <span
                                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${config.color}`}
                                    >
                                      {config.emoji}
                                      {config.label}
                                    </span>
                                  }
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Total points */}
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-lg font-bold ${sortBy === "totalPoints" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}
                    >
                      {entry.totalPoints}
                    </span>
                  </td>

                  {/* Last round */}
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-sm ${sortBy === "lastRoundPoints" ? "font-bold text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"}`}
                    >
                      {entry.lastRoundPoints > 0 ? `+${entry.lastRoundPoints}` : "0"}
                    </span>
                  </td>

                  {/* Bonus */}
                  {hasBonusPoints && (
                    <td className="px-4 py-3 text-right">
                      {(entry.totalBonusPoints ?? 0) > 0 ? (
                        <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                          +{entry.totalBonusPoints}★
                        </span>
                      ) : (
                        <span className="text-sm text-zinc-400 dark:text-zinc-500">–</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="mt-4 flex justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
        </div>
      )}
    </div>
  );
}

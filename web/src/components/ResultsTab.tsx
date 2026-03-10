"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useLive, useLiveMatch } from "./LiveProvider";
import { LiveBadge } from "./LiveBadge";
import { useTranslation } from "@/i18n/TranslationProvider";

/* ---------- Types ---------- */

interface Team {
  id: string;
  name: string;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
}

interface PredictionEntry {
  userId: string;
  userName: string | null;
  userImage: string | null;
  homeGoals: number;
  awayGoals: number;
  pointsAwarded: number | null;
  breakdown: {
    exactScore: number;
    goalDifference: number;
    outcome: number;
    oneTeamGoals: number;
    totalGoals: number;
    reverseGoalDifference: number;
  } | null;
}

interface MatchResult {
  id: string;
  matchDay: number | null;
  stage: string | null;
  status: string;
  kickoffTime: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: Team;
  awayTeam: Team;
  predictions: PredictionEntry[];
}

/* ---------- Helpers ---------- */

function pointsColorClass(points: number | null): string {
  if (points === null) return "text-zinc-400 dark:text-zinc-500";
  if (points >= 20) return "text-emerald-600 dark:text-emerald-400"; // exact or near-perfect
  if (points >= 10) return "text-blue-600 dark:text-blue-400"; // good
  if (points > 0) return "text-amber-600 dark:text-amber-400"; // partial
  return "text-zinc-400 dark:text-zinc-500"; // zero
}

function pointsBgClass(points: number | null): string {
  if (points === null) return "";
  if (points >= 20) return "bg-emerald-50 dark:bg-emerald-900/10";
  if (points >= 10) return "bg-blue-50 dark:bg-blue-900/10";
  if (points > 0) return "bg-amber-50 dark:bg-amber-900/10";
  return "";
}

function isExactHit(pred: PredictionEntry, result: MatchResult): boolean {
  return pred.homeGoals === result.homeGoals && pred.awayGoals === result.awayGoals;
}

/** Scoring factor badge definitions */
const FACTOR_BADGES: Array<{
  key: keyof NonNullable<PredictionEntry["breakdown"]>;
  labelKey: string;
  titleKey: string;
  color: string;
}> = [
  {
    key: "exactScore",
    labelKey: "results.exactScoreShort",
    titleKey: "results.exactScore",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  {
    key: "goalDifference",
    labelKey: "results.goalDifferenceShort",
    titleKey: "results.goalDifference",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    key: "outcome",
    labelKey: "results.outcomeShort",
    titleKey: "results.outcome",
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  {
    key: "oneTeamGoals",
    labelKey: "results.oneTeamGoalsShort",
    titleKey: "results.oneTeamGoals",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  {
    key: "totalGoals",
    labelKey: "results.totalGoalsShort",
    titleKey: "results.totalGoals",
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  },
  {
    key: "reverseGoalDifference",
    labelKey: "results.reverseGoalDiffShort",
    titleKey: "results.reverseGoalDiff",
    color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  },
];

function BreakdownBadges({ breakdown }: { breakdown: NonNullable<PredictionEntry["breakdown"]> }) {
  const { t } = useTranslation();
  const activeBadges = FACTOR_BADGES.filter((f) => breakdown[f.key] > 0);
  if (activeBadges.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5">
      {activeBadges.map((badge) => (
        <span
          key={badge.key}
          title={t("results.factorTooltip", {
            factor: t(badge.titleKey),
            points: String(breakdown[badge.key]),
          })}
          className={`inline-flex items-center rounded px-1 py-0.5 text-[10px] font-bold leading-none ${badge.color}`}
        >
          {t(badge.labelKey)}
        </span>
      ))}
    </div>
  );
}

/* ---------- Component ---------- */

function MatchScore({ match }: { match: MatchResult }) {
  const liveData = useLiveMatch(match.id);
  const { t } = useTranslation();
  const isLive =
    match.status === "IN_PLAY" ||
    match.status === "PAUSED" ||
    liveData?.status === "IN_PLAY" ||
    liveData?.status === "PAUSED";
  const status = liveData?.status ?? match.status;
  const homeGoals = liveData?.homeGoals ?? match.homeGoals;
  const awayGoals = liveData?.awayGoals ?? match.awayGoals;

  return (
    <div className="mx-3 min-w-[60px] text-center">
      {homeGoals !== null && awayGoals !== null ? (
        <span
          className={`text-lg font-bold ${isLive ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"}`}
        >
          {homeGoals} – {awayGoals}
        </span>
      ) : (
        <span className="text-sm text-zinc-400">{t("results.vs")}</span>
      )}
      {(isLive || status === "IN_PLAY" || status === "PAUSED") && (
        <div className="mt-0.5">
          <LiveBadge status={status} />
        </div>
      )}
    </div>
  );
}

export default function ResultsTab({ groupId }: { groupId: string }) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [matchDays, setMatchDays] = useState<number[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { scoresVersion } = useLive();
  const { t } = useTranslation();

  const fetchResults = useCallback(
    async (matchDay?: number | null) => {
      setLoading(true);
      try {
        const url =
          matchDay != null
            ? `/api/groups/${groupId}/results?matchDay=${matchDay}`
            : `/api/groups/${groupId}/results`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch results");
        const data = await res.json();
        setResults(data.results);
        setMatchDays(data.matchDays);
        if (selectedDay === null && data.matchDays.length > 0) {
          setSelectedDay(data.matchDays[0]); // latest match day
        }
      } catch (err) {
        console.error("Failed to load results:", err);
        setError("Failed to load results. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [groupId, selectedDay],
  );

  useEffect(() => {
    fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh when predictions are scored (via SSE)
  useEffect(() => {
    if (scoresVersion > 0) {
      fetchResults(selectedDay);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoresVersion]);

  const handleDayChange = (day: number) => {
    setSelectedDay(day);
    setExpandedMatches(new Set());
    fetchResults(day);
  };

  const toggleMatch = (matchId: string) => {
    setExpandedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  };

  const dayIdx = matchDays.indexOf(selectedDay ?? -1);

  /* ---- Render ---- */

  if (loading && results.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
      </div>
    );
  }

  if (results.length === 0 && !loading) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 px-8 py-16 text-center dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {t("results.noResults")}
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t("results.noResultsDesc")}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button
            onClick={() => {
              setError(null);
              fetchResults(selectedDay);
            }}
            className="ml-2 underline"
          >
            {t("results.retry")}
          </button>
        </div>
      )}

      {/* Match-day navigation */}
      {matchDays.length > 1 && (
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => dayIdx > 0 && handleDayChange(matchDays[dayIdx - 1])}
            disabled={dayIdx <= 0}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <svg
              className="inline h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>{" "}
            {t("results.prev")}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {t("results.matchDay", { n: selectedDay ?? 0 })}
            </span>
            <select
              value={selectedDay ?? ""}
              onChange={(e) => handleDayChange(Number(e.target.value))}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {matchDays.map((d) => (
                <option key={d} value={d}>
                  {t("results.mdShort", { n: d })}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => dayIdx < matchDays.length - 1 && handleDayChange(matchDays[dayIdx + 1])}
            disabled={dayIdx >= matchDays.length - 1}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t("results.next")}{" "}
            <svg
              className="inline h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}

      {/* Match results */}
      <div className="space-y-3">
        {results.map((match) => {
          const isExpanded = expandedMatches.has(match.id);

          return (
            <div
              key={match.id}
              className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700"
            >
              {/* Match header — clickable to expand */}
              <button
                onClick={() => toggleMatch(match.id)}
                className="flex w-full items-center justify-between bg-white px-4 py-3 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
              >
                <div className="flex flex-1 items-center gap-3">
                  {/* Home team */}
                  <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {match.homeTeam.shortName || match.homeTeam.name}
                    </span>
                    {match.homeTeam.crest && (
                      <Image
                        src={match.homeTeam.crest}
                        alt={match.homeTeam.name}
                        width={20}
                        height={20}
                        className="h-5 w-5 object-contain"
                        unoptimized
                      />
                    )}
                  </div>

                  {/* Score — live-aware */}
                  <MatchScore match={match} />

                  {/* Away team */}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {match.awayTeam.crest && (
                      <Image
                        src={match.awayTeam.crest}
                        alt={match.awayTeam.name}
                        width={20}
                        height={20}
                        className="h-5 w-5 shrink-0 object-contain"
                        unoptimized
                      />
                    )}
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {match.awayTeam.shortName || match.awayTeam.name}
                    </span>
                  </div>
                </div>

                {/* Expand/collapse indicator */}
                <div className="ml-3 flex items-center gap-2">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {t("results.tipCount", { count: match.predictions.length })}
                  </span>
                  <svg
                    className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m19.5 8.25-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </div>
              </button>

              {/* Predictions list (expanded) */}
              {isExpanded && (
                <div className="border-t border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-800/20">
                  {match.predictions.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
                      {t("results.noPredictions")}
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {match.predictions.map((pred) => {
                        const exact = isExactHit(pred, match);
                        return (
                          <div
                            key={pred.userId}
                            className={`flex items-center justify-between px-4 py-2.5 ${pointsBgClass(pred.pointsAwarded)}`}
                          >
                            {/* User info */}
                            <div className="flex items-center gap-2">
                              {pred.userImage ? (
                                <Image
                                  src={pred.userImage}
                                  alt=""
                                  width={24}
                                  height={24}
                                  className="h-6 w-6 rounded-full"
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                                  {(pred.userName ?? "?")[0]?.toUpperCase()}
                                </div>
                              )}
                              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                                {pred.userName ?? t("results.unknown")}
                              </span>
                            </div>

                            {/* Prediction + breakdown + points */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                {pred.homeGoals} – {pred.awayGoals}
                              </span>
                              {pred.breakdown && <BreakdownBadges breakdown={pred.breakdown} />}
                              <div className="flex items-center gap-1">
                                {exact && (
                                  <span className="text-xs" title={t("results.exactScoreBang")}>
                                    🎯
                                  </span>
                                )}
                                <span
                                  className={`min-w-[36px] text-right text-sm font-bold ${pointsColorClass(pred.pointsAwarded)}`}
                                >
                                  {pred.pointsAwarded != null
                                    ? t("results.points", { n: pred.pointsAwarded })
                                    : t("results.noPoints")}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {loading && results.length > 0 && (
        <div className="mt-4 flex justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

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
}

interface MatchResult {
  id: string;
  matchDay: number | null;
  stage: string | null;
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

/* ---------- Component ---------- */

export default function ResultsTab({ groupId }: { groupId: string }) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [matchDays, setMatchDays] = useState<number[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleDayChange = (day: number) => {
    setSelectedDay(day);
    setExpandedMatch(null);
    fetchResults(day);
  };

  const toggleMatch = (matchId: string) => {
    setExpandedMatch((prev) => (prev === matchId ? null : matchId));
  };

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
          No results yet
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Results will appear here once matches have been played.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Match-day filter */}
      {matchDays.length > 1 && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Match Day:
          </label>
          <select
            value={selectedDay ?? ""}
            onChange={(e) => handleDayChange(Number(e.target.value))}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {matchDays.map((d) => (
              <option key={d} value={d}>
                MD {d}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Match results */}
      <div className="space-y-3">
        {results.map((match) => {
          const isExpanded = expandedMatch === match.id;

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
                  <div className="flex flex-1 items-center justify-end gap-2 text-right">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {match.homeTeam.shortName || match.homeTeam.name}
                    </span>
                    {match.homeTeam.crest && (
                      <img
                        src={match.homeTeam.crest}
                        alt={match.homeTeam.name}
                        className="h-5 w-5 object-contain"
                      />
                    )}
                  </div>

                  {/* Score */}
                  <div className="mx-3 min-w-[60px] text-center">
                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {match.homeGoals} – {match.awayGoals}
                    </span>
                  </div>

                  {/* Away team */}
                  <div className="flex flex-1 items-center gap-2">
                    {match.awayTeam.crest && (
                      <img
                        src={match.awayTeam.crest}
                        alt={match.awayTeam.name}
                        className="h-5 w-5 object-contain"
                      />
                    )}
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {match.awayTeam.shortName || match.awayTeam.name}
                    </span>
                  </div>
                </div>

                {/* Expand/collapse indicator */}
                <div className="ml-3 flex items-center gap-2">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {match.predictions.length} tip{match.predictions.length !== 1 ? "s" : ""}
                  </span>
                  <svg
                    className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </button>

              {/* Predictions list (expanded) */}
              {isExpanded && (
                <div className="border-t border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-800/20">
                  {match.predictions.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
                      No predictions for this match
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
                                <img
                                  src={pred.userImage}
                                  alt=""
                                  className="h-6 w-6 rounded-full"
                                />
                              ) : (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                                  {(pred.userName ?? "?")[0]?.toUpperCase()}
                                </div>
                              )}
                              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                                {pred.userName ?? "Unknown"}
                              </span>
                            </div>

                            {/* Prediction + points */}
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                {pred.homeGoals} – {pred.awayGoals}
                              </span>
                              <div className="flex items-center gap-1">
                                {exact && (
                                  <span className="text-xs" title="Exact score!">
                                    🎯
                                  </span>
                                )}
                                <span
                                  className={`min-w-[36px] text-right text-sm font-bold ${pointsColorClass(pred.pointsAwarded)}`}
                                >
                                  {pred.pointsAwarded != null
                                    ? `${pred.pointsAwarded} pt${pred.pointsAwarded !== 1 ? "s" : ""}`
                                    : "–"}
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslation } from "@/i18n/TranslationProvider";

/* ---------- Types ---------- */

interface TeamRecord {
  wins: number;
  losses: number;
  draws: number;
}

interface Team {
  id: string;
  name: string;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
  record?: TeamRecord;
}

interface Match {
  id: string;
  matchDay: number | null;
  stage: string | null;
  homeTeam: Team;
  awayTeam: Team;
  kickoffTime: string;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
}

interface PredictionData {
  homeGoals: number;
  awayGoals: number;
  pointsAwarded: number | null;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

/* ---------- Helpers ---------- */

function isLocked(match: Match): boolean {
  const lockedStatuses = ["IN_PLAY", "PAUSED", "FINISHED", "AWARDED"];
  if (lockedStatuses.includes(match.status)) return true;
  return new Date(match.kickoffTime) <= new Date();
}

/** Date-only label for day group headers */
function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Time-only label for individual match rows */
function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Group matches by calendar date string */
function groupMatchesByDate(matches: Match[]): [string, Match[]][] {
  const groups = new Map<string, Match[]>();
  for (const match of matches) {
    const dateKey = new Date(match.kickoffTime).toLocaleDateString();
    const list = groups.get(dateKey) ?? [];
    list.push(match);
    groups.set(dateKey, list);
  }
  return Array.from(groups.entries());
}

function statusLabel(status: string, t: (key: string) => string): string {
  switch (status) {
    case "SCHEDULED":
    case "TIMED":
      return "";
    case "IN_PLAY":
      return t("predictions.live");
    case "PAUSED":
      return t("predictions.ht");
    case "FINISHED":
      return t("predictions.ft");
    case "AWARDED":
      return t("predictions.awarded");
    case "POSTPONED":
      return t("predictions.postponed");
    case "CANCELLED":
      return t("predictions.cancelled");
    default:
      return status;
  }
}

/** Return Tailwind classes for W-L-D badge based on record comparison */
function recordColorClasses(r: TeamRecord): string {
  if (r.wins > r.losses && r.wins > r.draws) {
    // More wins
    return "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30";
  }
  if (r.losses > r.wins && r.losses > r.draws) {
    // More losses
    return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30";
  }
  // Draws dominate or equal
  return "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30";
}

/* ---------- Component ---------- */

export default function PredictionsTab({ groupId }: { groupId: string }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, PredictionData>>({});
  const [matchDays, setMatchDays] = useState<number[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const { t } = useTranslation();

  /* ---- Fetch matches ---- */
  const fetchMatches = useCallback(
    async (matchDay?: number | null) => {
      setLoading(true);
      try {
        const url =
          matchDay != null
            ? `/api/groups/${groupId}/matches?matchDay=${matchDay}`
            : `/api/groups/${groupId}/matches`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch matches");
        const data = await res.json();
        setMatches(data.matches);
        setMatchDays(data.matchDays);

        // Auto-select the first match day with upcoming matches, or last
        if (matchDay == null && data.matchDays.length > 0) {
          const now = new Date();
          const upcoming = data.matches.find((m: Match) => new Date(m.kickoffTime) > now);
          const defaultDay = upcoming?.matchDay ?? data.matchDays[data.matchDays.length - 1];
          if (defaultDay != null) {
            setSelectedDay(defaultDay);
            // Re-fetch filtered
            const filtered = await fetch(`/api/groups/${groupId}/matches?matchDay=${defaultDay}`);
            if (filtered.ok) {
              const filteredData = await filtered.json();
              setMatches(filteredData.matches);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load matches:", err);
        setError("Failed to load matches. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [groupId],
  );

  /* ---- Fetch user's predictions ---- */
  const fetchPredictions = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/predictions`);
      if (!res.ok) throw new Error("Failed to fetch predictions");
      const data = await res.json();
      setPredictions(data.predictions);
    } catch (err) {
      console.error("Failed to load predictions:", err);
      setError("Failed to load predictions.");
    }
  }, [groupId]);

  useEffect(() => {
    fetchMatches();
    fetchPredictions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Navigate match days ---- */
  const handleDayChange = async (day: number) => {
    setSelectedDay(day);
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/matches?matchDay=${day}`);
      if (!res.ok) throw new Error("Failed to fetch matches");
      const data = await res.json();
      setMatches(data.matches);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ---- Save prediction (debounced) ---- */
  const savePrediction = useCallback(
    (matchId: string, homeGoals: number, awayGoals: number) => {
      // Clear existing debounce
      if (debounceTimers.current[matchId]) {
        clearTimeout(debounceTimers.current[matchId]);
      }

      setSaveStatuses((s) => ({ ...s, [matchId]: "saving" }));

      debounceTimers.current[matchId] = setTimeout(async () => {
        try {
          const res = await fetch(`/api/groups/${groupId}/predictions`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matchId, homeGoals, awayGoals }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to save");
          }
          setSaveStatuses((s) => ({ ...s, [matchId]: "saved" }));
          // Clear "saved" indicator after 2s
          setTimeout(() => {
            setSaveStatuses((s) => ({ ...s, [matchId]: "idle" }));
          }, 2000);
        } catch (err) {
          console.error("Save failed:", err);
          setSaveStatuses((s) => ({ ...s, [matchId]: "error" }));
        }
      }, 600);
    },
    [groupId],
  );

  /* ---- Handle input change ---- */
  const handleScoreChange = (matchId: string, side: "home" | "away", value: string) => {
    const num = value === "" ? 0 : parseInt(value, 10);
    if (isNaN(num) || num < 0) return;

    const current = predictions[matchId] || { homeGoals: 0, awayGoals: 0, pointsAwarded: null };
    const updated = {
      ...current,
      [side === "home" ? "homeGoals" : "awayGoals"]: num,
    };
    setPredictions((prev) => ({ ...prev, [matchId]: updated }));
    savePrediction(matchId, updated.homeGoals, updated.awayGoals);
  };

  /* ---- Cleanup debounce timers ---- */
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  /* ---- Render ---- */
  const dayIdx = matchDays.indexOf(selectedDay ?? -1);

  if (loading && matches.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
      </div>
    );
  }

  if (matches.length === 0 && !loading) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 px-8 py-16 text-center dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {t("predictions.noMatches")}
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t("predictions.noMatchesDesc")}
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
              fetchMatches(selectedDay);
              fetchPredictions();
            }}
            className="ml-2 underline"
          >
            {t("predictions.retry")}
          </button>
        </div>
      )}
      {/* Match-day navigation */}
      {matchDays.length > 1 && (
        <div className="mb-6 flex items-center justify-between">
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
            {t("predictions.prev")}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {t("predictions.matchDay", { n: selectedDay ?? 0 })}
            </span>
            {/* Quick-jump select */}
            <select
              value={selectedDay ?? ""}
              onChange={(e) => handleDayChange(Number(e.target.value))}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {matchDays.map((d) => (
                <option key={d} value={d}>
                  {t("predictions.mdShort", { n: d })}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => dayIdx < matchDays.length - 1 && handleDayChange(matchDays[dayIdx + 1])}
            disabled={dayIdx >= matchDays.length - 1}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t("predictions.next")}{" "}
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

      {/* Match list grouped by date */}
      <div className="space-y-6">
        {groupMatchesByDate(matches).map(([dateKey, dayMatches]) => (
          <div key={dateKey}>
            {/* Date header */}
            <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700 pb-2">
              {formatDateHeader(dayMatches[0].kickoffTime)}
            </h3>
            <div className="space-y-3">
              {dayMatches.map((match) => {
                const locked = isLocked(match);
                const pred = predictions[match.id];
                const status = saveStatuses[match.id] || "idle";

                return (
                  <div
                    key={match.id}
                    className={`relative rounded-xl border p-4 transition-colors ${
                      locked
                        ? "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50"
                        : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                    }`}
                  >
                    {/* Top row: kickoff time + status */}
                    <div className="mb-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{formatTime(match.kickoffTime)}</span>
                      <div className="flex items-center gap-2">
                        {/* Save status indicator */}
                        {status === "saving" && (
                          <span className="text-amber-500">{t("predictions.saving")}</span>
                        )}
                        {status === "saved" && (
                          <span className="text-emerald-500">{t("predictions.saved")}</span>
                        )}
                        {status === "error" && (
                          <span className="text-red-500">{t("predictions.failedToSave")}</span>
                        )}
                        {/* Status badge */}
                        {statusLabel(match.status, t) && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              match.status === "IN_PLAY" || match.status === "PAUSED"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : match.status === "FINISHED" || match.status === "AWARDED"
                                  ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            }`}
                          >
                            {statusLabel(match.status, t)}
                          </span>
                        )}
                        {/* Lock icon */}
                        {locked && (
                          <svg
                            className="h-4 w-4 text-zinc-400 dark:text-zinc-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            aria-label={t("predictions.locked")}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                            />
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Match card body: Home — Score Inputs — Away */}
                    <div className="flex items-center justify-between gap-4">
                      {/* Home team */}
                      <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5">
                        <div className="flex items-center justify-end gap-2">
                          <span className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {match.homeTeam.shortName || match.homeTeam.name}
                          </span>
                          {match.homeTeam.crest && (
                            <Image
                              src={match.homeTeam.crest}
                              alt={match.homeTeam.name}
                              width={28}
                              height={28}
                              className="h-7 w-7 object-contain"
                              unoptimized
                            />
                          )}
                        </div>
                        {match.homeTeam.record &&
                          match.homeTeam.record.wins +
                            match.homeTeam.record.losses +
                            match.homeTeam.record.draws >
                            0 && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums ${recordColorClasses(match.homeTeam.record)}`}
                            >
                              {match.homeTeam.record.wins}-{match.homeTeam.record.losses}-
                              {match.homeTeam.record.draws}
                            </span>
                          )}
                      </div>

                      {/* Score inputs */}
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={pred?.homeGoals ?? ""}
                          onChange={(e) => handleScoreChange(match.id, "home", e.target.value)}
                          disabled={locked}
                          placeholder="-"
                          className={`h-10 w-12 rounded-lg border text-center text-lg font-bold
                      ${
                        locked
                          ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                          : "border-zinc-300 bg-white text-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      } [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                          aria-label={t("predictions.homeScore", {
                            home: match.homeTeam.name,
                            away: match.awayTeam.name,
                          })}
                        />
                        <span className="mx-1 text-sm font-medium text-zinc-400">–</span>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={pred?.awayGoals ?? ""}
                          onChange={(e) => handleScoreChange(match.id, "away", e.target.value)}
                          disabled={locked}
                          placeholder="-"
                          className={`h-10 w-12 rounded-lg border text-center text-lg font-bold
                      ${
                        locked
                          ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                          : "border-zinc-300 bg-white text-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      } [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                          aria-label={t("predictions.awayScore", {
                            home: match.homeTeam.name,
                            away: match.awayTeam.name,
                          })}
                        />
                      </div>

                      {/* Away team */}
                      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                        <div className="flex items-center gap-2">
                          {match.awayTeam.crest && (
                            <Image
                              src={match.awayTeam.crest}
                              alt={match.awayTeam.name}
                              width={28}
                              height={28}
                              className="h-7 w-7 shrink-0 object-contain"
                              unoptimized
                            />
                          )}
                          <span className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {match.awayTeam.shortName || match.awayTeam.name}
                          </span>
                        </div>
                        {match.awayTeam.record &&
                          match.awayTeam.record.wins +
                            match.awayTeam.record.losses +
                            match.awayTeam.record.draws >
                            0 && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums ${recordColorClasses(match.awayTeam.record)}`}
                            >
                              {match.awayTeam.record.wins}-{match.awayTeam.record.losses}-
                              {match.awayTeam.record.draws}
                            </span>
                          )}
                      </div>
                    </div>

                    {/* Actual result (for finished matches) */}
                    {(match.status === "FINISHED" || match.status === "AWARDED") &&
                      match.homeGoals != null &&
                      match.awayGoals != null && (
                        <div className="mt-3 flex justify-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                            {t("predictions.result", {
                              home: String(match.homeGoals),
                              away: String(match.awayGoals),
                            })}
                          </span>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Loading overlay for day change */}
      {loading && matches.length > 0 && (
        <div className="mt-4 flex justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
        </div>
      )}
    </div>
  );
}

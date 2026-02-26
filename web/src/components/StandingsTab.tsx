"use client";

import { useCallback, useEffect, useState } from "react";
import { useLive } from "./LiveProvider";
import { useTranslation } from "@/i18n/TranslationProvider";

/* ---------- Types ---------- */

interface StandingEntry {
  rank: number;
  userId: string;
  userName: string | null;
  userImage: string | null;
  role: string;
  totalPoints: number;
  predictionsScored: number;
  lastRoundPoints: number;
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
  const [matchDays, setMatchDays] = useState<number[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { scoresVersion } = useLive();
  const { t } = useTranslation();

  const fetchStandings = useCallback(
    async (matchDay?: number | null) => {
      setLoading(true);
      try {
        const url =
          matchDay != null
            ? `/api/groups/${groupId}/standings?matchDay=${matchDay}`
            : `/api/groups/${groupId}/standings`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch standings");
        const data = await res.json();
        setStandings(data.standings);
        setMatchDays(data.matchDays);
        if (selectedDay === null && data.selectedMatchDay != null) {
          setSelectedDay(data.selectedMatchDay);
        }
      } catch (err) {
        console.error("Failed to load standings:", err);
        setError("Failed to load standings. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [groupId, selectedDay],
  );

  useEffect(() => {
    fetchStandings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh when predictions are scored (via SSE)
  useEffect(() => {
    if (scoresVersion > 0) {
      fetchStandings(selectedDay);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoresVersion]);

  const handleDayChange = (day: number) => {
    setSelectedDay(day);
    fetchStandings(day);
  };

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

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={() => { setError(null); fetchStandings(selectedDay); }} className="ml-2 underline">
            {t("standings.retry")}
          </button>
        </div>
      )}

      {/* Match-day filter */}
      {matchDays.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t("standings.lastRound")}
          </label>
          <select
            value={selectedDay ?? ""}
            onChange={(e) => handleDayChange(Number(e.target.value))}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {matchDays.map((d) => (
              <option key={d} value={d}>
                {t("standings.matchDay", { n: d })}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Standings table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
              <th className="w-12 px-4 py-3 text-center">{t("standings.rank")}</th>
              <th className="px-4 py-3">{t("standings.player")}</th>
              <th className="w-24 px-4 py-3 text-right">{t("standings.pointsHeader")}</th>
              <th className="hidden w-24 px-4 py-3 text-right sm:table-cell">
                {t("standings.lastRoundHeader")}
              </th>
              <th className="hidden w-20 px-4 py-3 text-right sm:table-cell">
                {t("standings.tips")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {standings.map((entry) => {
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
                      {entry.userImage ? (
                        <img
                          src={entry.userImage}
                          alt=""
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                          {(entry.userName ?? "?")[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
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
                    </div>
                  </td>

                  {/* Total points */}
                  <td className="px-4 py-3 text-right">
                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {entry.totalPoints}
                    </span>
                  </td>

                  {/* Last round */}
                  <td className="hidden px-4 py-3 text-right sm:table-cell">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {entry.lastRoundPoints > 0 ? `+${entry.lastRoundPoints}` : "0"}
                    </span>
                  </td>

                  {/* Tips count */}
                  <td className="hidden px-4 py-3 text-right sm:table-cell">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {entry.predictionsScored}
                    </span>
                  </td>
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

"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";

interface Competition {
  id: number;
  name: string;
  leagueId: number;
  type: string;
  emblem: string | null;
  area: string;
  areaFlag: string | null;
  currentSeason: { startDate: string | null; endDate: string | null } | null;
  numberOfAvailableSeasons: number;
  synced: boolean;
}

interface LocalContest {
  id: string;
  code: string;
  season: string;
  name: string;
  status: string;
}

interface SyncResult {
  contestId: string;
  teamsUpserted: number;
  matchesUpserted: number;
  predictionsScored: number;
  warning?: string;
}

export default function AdminCompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [localContests, setLocalContests] = useState<LocalContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ leagueId: number; result: SyncResult } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const fetchCompetitions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/competitions");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCompetitions(data.competitions ?? []);
      setLocalContests(data.localContests ?? []);
    } catch {
      setError("Failed to load competitions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompetitions();
  }, [fetchCompetitions]);

  const handleSync = async (leagueId: number) => {
    setSyncing(String(leagueId));
    setSyncResult(null);
    setSyncError(null);

    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");

      setSyncResult({ leagueId, result: data.result });
      // Refresh the list to update synced status
      await fetchCompetitions();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  const filtered = competitions.filter(
    (c) =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      String(c.leagueId).includes(filter) ||
      c.area.toLowerCase().includes(filter.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
        {error}
        <button onClick={fetchCompetitions} className="ml-2 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Synced contests summary */}
      {localContests.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Synced Competitions ({localContests.length})
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {localContests.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400"
              >
                {c.code} — {c.season}
                <span className="text-green-600 dark:text-green-500">
                  ({c.status.toLowerCase()})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sync result banner */}
      {syncResult && (
        <div className={`rounded-lg border p-4 text-sm ${
          syncResult.result.warning
            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
            : "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
        }`}>
          <strong>Sync complete for {syncResult.leagueId}:</strong>{" "}
          {syncResult.result.teamsUpserted} teams, {syncResult.result.matchesUpserted} matches
          {syncResult.result.predictionsScored > 0 &&
            `, ${syncResult.result.predictionsScored} predictions scored`}
          {syncResult.result.warning && (
            <div className="mt-1 text-xs">
              ⚠️ API note: {syncResult.result.warning}
            </div>
          )}
          <button
            onClick={() => setSyncResult(null)}
            className={`ml-2 underline ${syncResult.result.warning ? "text-amber-600 dark:text-amber-500" : "text-green-600 dark:text-green-500"}`}
          >
            Dismiss
          </button>
        </div>
      )}

      {syncError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {syncError}
          <button
            onClick={() => setSyncError(null)}
            className="ml-2 text-red-600 underline dark:text-red-500"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search / filter */}
      <div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search competitions by name, id, or region..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>

      {/* Competitions list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No competitions match your search.
          </p>
        ) : (
          filtered.map((comp) => (
            <div
              key={comp.id}
              className="flex flex-wrap items-center justify-between gap-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="flex items-center gap-3">
                {comp.emblem && (
                  <Image
                    src={comp.emblem}
                    alt={comp.name}
                    width={32}
                    height={32}
                    className="h-8 w-8 object-contain"
                    unoptimized
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {comp.name}
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                      #{comp.leagueId}
                    </span>
                    {comp.synced && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Synced
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {comp.area} · {comp.type}
                    {comp.currentSeason?.startDate && comp.currentSeason?.endDate &&
                      ` · Season: ${comp.currentSeason.startDate.slice(0, 4)}–${comp.currentSeason.endDate.slice(0, 4)}`}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleSync(comp.leagueId)}
                disabled={syncing !== null}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  syncing === String(comp.leagueId)
                    ? "cursor-wait bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                    : comp.synced
                      ? "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                }`}
              >
                {syncing === String(comp.leagueId) ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-zinc-600" />
                    Syncing...
                  </span>
                ) : comp.synced ? (
                  "Re-sync"
                ) : (
                  "Sync"
                )}
              </button>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Showing {filtered.length} of {competitions.length} leagues from API-Football.
      </p>
    </div>
  );
}

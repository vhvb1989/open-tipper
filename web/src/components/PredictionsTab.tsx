"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslation } from "@/i18n/TranslationProvider";
import PodiumSection from "./PodiumSection";
import type { Round } from "@/lib/rounds";

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

type RiskCategory = "YELLOW_CARDS" | "RED_CARDS" | "CORNER_KICKS" | "OFFSIDES";
type RiskPredictionStatus = "PENDING" | "WON" | "LOST" | "CANCELLED";

interface RiskPredictionData {
  id: string;
  category: RiskCategory;
  predictedValue: number;
  pointsRisked: number;
  status: RiskPredictionStatus;
}

interface RiskFormState {
  enabled: boolean;
  predictedValue: string;
  pointsRisked: string;
  submitting: boolean;
  error: string | null;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";
type SyncStatus = "idle" | "syncing" | "synced" | "error";

interface SiblingGroup {
  id: string;
  name: string;
}

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

const RISK_OPTIONS: Array<{
  category: RiskCategory;
  icon: string;
  labelKey: string;
}> = [
  { category: "YELLOW_CARDS", icon: "🟨", labelKey: "predictions.riskYellowCards" },
  { category: "RED_CARDS", icon: "🟥", labelKey: "predictions.riskRedCards" },
  { category: "CORNER_KICKS", icon: "⚑", labelKey: "predictions.riskCornerKicks" },
  { category: "OFFSIDES", icon: "🚫", labelKey: "predictions.riskOffsides" },
];

const EMPTY_RISK_FORM: RiskFormState = {
  enabled: false,
  predictedValue: "",
  pointsRisked: "",
  submitting: false,
  error: null,
};

/* ---------- Component ---------- */

export default function PredictionsTab({
  groupId,
  hasPodium,
  riskEnabled = false,
}: {
  groupId: string;
  hasPodium?: boolean;
  riskEnabled?: boolean;
}) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, PredictionData>>({});
  const [riskPredictions, setRiskPredictions] = useState<Record<string, RiskPredictionData[]>>({});
  const [availableBalance, setAvailableBalance] = useState(0);
  const [riskExpandedMatches, setRiskExpandedMatches] = useState<Set<string>>(new Set());
  const [riskForms, setRiskForms] = useState<
    Record<string, Partial<Record<RiskCategory, RiskFormState>>>
  >({});
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundKey, setSelectedRoundKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({});
  const [siblingGroups, setSiblingGroups] = useState<SiblingGroup[]>([]);
  const [syncAllStatus, setSyncAllStatus] = useState<SyncStatus>("idle");
  const [matchSyncStatuses, setMatchSyncStatuses] = useState<Record<string, SyncStatus>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const { t } = useTranslation();
  const hasMultipleGroups = siblingGroups.length > 0;

  /* ---- Build URL for a round ---- */
  const buildMatchesUrl = useCallback(
    (round?: Round | null) => {
      let url = `/api/groups/${groupId}/matches`;
      if (round?.type === "matchDay" && round.matchDay != null) {
        url += `?matchDay=${round.matchDay}`;
      } else if (round?.type === "playoff" && round.stage) {
        url += `?stage=${encodeURIComponent(round.stage)}`;
      }
      return url;
    },
    [groupId],
  );

  /* ---- Fetch matches ---- */
  const fetchMatches = useCallback(
    async (round?: Round | null) => {
      setLoading(true);
      try {
        const url = buildMatchesUrl(round);
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch matches");
        const data = await res.json();
        setMatches(data.matches);
        if (data.rounds) setRounds(data.rounds);

        // Auto-select the first round with upcoming matches, or the last round
        if (round == null && data.rounds && data.rounds.length > 0) {
          const now = new Date();
          const upcoming = data.matches.find((m: Match) => new Date(m.kickoffTime) > now);
          let defaultRound: Round | null = null;

          if (upcoming) {
            // Find the round that contains this upcoming match
            if (upcoming.matchDay != null) {
              defaultRound =
                data.rounds.find(
                  (r: Round) => r.type === "matchDay" && r.matchDay === upcoming.matchDay,
                ) ?? null;
            } else if (upcoming.stage) {
              defaultRound =
                data.rounds.find(
                  (r: Round) => r.type === "playoff" && r.stage === upcoming.stage,
                ) ?? null;
            }
          }
          if (!defaultRound) {
            defaultRound = data.rounds[data.rounds.length - 1];
          }

          if (defaultRound) {
            setSelectedRoundKey(defaultRound.key);
            // Re-fetch filtered
            const filteredUrl = buildMatchesUrl(defaultRound);
            const filtered = await fetch(filteredUrl);
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
    [buildMatchesUrl],
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

  /* ---- Fetch user's risk predictions ---- */
  const fetchRiskPredictions = useCallback(async () => {
    if (!riskEnabled) {
      setRiskPredictions({});
      setAvailableBalance(0);
      return;
    }

    try {
      const res = await fetch(`/api/groups/${groupId}/predictions/risk`);
      if (!res.ok) throw new Error("Failed to fetch risk predictions");
      const data = await res.json();
      setRiskPredictions(data.risks ?? data.riskPredictions ?? {});
      setAvailableBalance(typeof data.balance === "number" ? data.balance : 0);
    } catch (err) {
      console.error("Failed to load risk predictions:", err);
      setError("Failed to load predictions.");
    }
  }, [groupId, riskEnabled]);

  /* ---- Fetch sibling groups (same contest) ---- */
  const fetchSiblingGroups = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/sibling-groups`);
      if (!res.ok) return;
      const data = await res.json();
      setSiblingGroups(data.groups ?? []);
    } catch {
      // Non-critical — just means sync buttons won't show
    }
  }, [groupId]);

  /* ---- Sync prediction to all groups ---- */
  const syncPredictionToAllGroups = useCallback(
    async (matchId: string) => {
      setMatchSyncStatuses((s) => ({ ...s, [matchId]: "syncing" }));
      try {
        const res = await fetch(`/api/groups/${groupId}/predictions/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to sync");
        }
        setMatchSyncStatuses((s) => ({ ...s, [matchId]: "synced" }));
        setTimeout(() => {
          setMatchSyncStatuses((s) => ({ ...s, [matchId]: "idle" }));
        }, 2000);
      } catch (err) {
        console.error("Sync failed:", err);
        setMatchSyncStatuses((s) => ({ ...s, [matchId]: "error" }));
        setTimeout(() => {
          setMatchSyncStatuses((s) => ({ ...s, [matchId]: "idle" }));
        }, 3000);
      }
    },
    [groupId],
  );

  /* ---- Sync all predictions to all groups ---- */
  const syncAllPredictions = useCallback(async () => {
    setSyncAllStatus("syncing");
    try {
      const res = await fetch(`/api/groups/${groupId}/predictions/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to sync");
      }
      setSyncAllStatus("synced");
      setTimeout(() => setSyncAllStatus("idle"), 3000);
    } catch (err) {
      console.error("Sync all failed:", err);
      setSyncAllStatus("error");
      setTimeout(() => setSyncAllStatus("idle"), 3000);
    }
  }, [groupId]);

  useEffect(() => {
    fetchMatches();
    fetchPredictions();
    fetchSiblingGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (riskEnabled) {
      fetchRiskPredictions();
      return;
    }

    setRiskPredictions({});
    setAvailableBalance(0);
    setRiskExpandedMatches(new Set());
    setRiskForms({});
  }, [fetchRiskPredictions, riskEnabled]);

  /* ---- Navigate rounds ---- */
  const handleRoundChange = async (round: Round) => {
    setSelectedRoundKey(round.key);
    setLoading(true);
    try {
      const res = await fetch(buildMatchesUrl(round));
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
    // Allow empty while editing — will default to 0 on blur
    if (value === "") {
      const current = predictions[matchId] || { homeGoals: 0, awayGoals: 0, pointsAwarded: null };
      setPredictions((prev) => ({
        ...prev,
        [matchId]: {
          ...current,
          [side === "home" ? "homeGoals" : "awayGoals"]: "" as unknown as number,
        },
      }));
      return;
    }

    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0 || num > 99) return;

    const current = predictions[matchId] || { homeGoals: 0, awayGoals: 0, pointsAwarded: null };
    const updated = {
      ...current,
      [side === "home" ? "homeGoals" : "awayGoals"]: num,
    };
    setPredictions((prev) => ({ ...prev, [matchId]: updated }));
    savePrediction(matchId, updated.homeGoals, updated.awayGoals);
  };

  /* ---- Handle blur: commit empty fields as 0 and save ---- */
  const handleScoreBlur = (matchId: string, side: "home" | "away") => {
    const current = predictions[matchId];
    if (!current) return;

    const fieldKey = side === "home" ? "homeGoals" : "awayGoals";
    const val = current[fieldKey];
    if (val === ("" as unknown as number) || val === undefined || val === null) {
      const updated = { ...current, [fieldKey]: 0 };
      setPredictions((prev) => ({ ...prev, [matchId]: updated }));
      savePrediction(matchId, updated.homeGoals, updated.awayGoals);
    }
  };

  /* ---- Select all text on focus for easy replacement ---- */
  const handleScoreFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const getRiskFormState = useCallback(
    (matchId: string, category: RiskCategory): RiskFormState =>
      riskForms[matchId]?.[category] ?? EMPTY_RISK_FORM,
    [riskForms],
  );

  const updateRiskFormState = useCallback(
    (
      matchId: string,
      category: RiskCategory,
      updater: RiskFormState | ((current: RiskFormState) => RiskFormState),
    ) => {
      setRiskForms((prev) => {
        const current = prev[matchId]?.[category] ?? EMPTY_RISK_FORM;
        const next = typeof updater === "function" ? updater(current) : updater;
        return {
          ...prev,
          [matchId]: {
            ...prev[matchId],
            [category]: next,
          },
        };
      });
    },
    [],
  );

  const toggleRiskSection = useCallback((matchId: string) => {
    setRiskExpandedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  }, []);

  const handleRiskToggle = useCallback(
    (matchId: string, category: RiskCategory) => {
      updateRiskFormState(matchId, category, (current) => ({
        ...EMPTY_RISK_FORM,
        enabled: !current.enabled,
      }));
    },
    [updateRiskFormState],
  );

  const handleRiskInputChange = useCallback(
    (
      matchId: string,
      category: RiskCategory,
      field: "pointsRisked" | "predictedValue",
      value: string,
    ) => {
      if (value !== "" && !/^\d+$/.test(value)) return;
      updateRiskFormState(matchId, category, (current) => ({
        ...current,
        [field]: value,
        error: null,
      }));
    },
    [updateRiskFormState],
  );

  const handleRiskConfirm = useCallback(
    async (matchId: string, category: RiskCategory) => {
      const current = getRiskFormState(matchId, category);
      const pointsRisked = Number.parseInt(current.pointsRisked, 10);
      const predictedValue = Number.parseInt(current.predictedValue, 10);

      if (!Number.isInteger(pointsRisked) || pointsRisked < 1) {
        updateRiskFormState(matchId, category, (form) => ({
          ...form,
          error: t("predictions.riskPointsToRisk"),
        }));
        return;
      }

      if (!Number.isInteger(predictedValue) || predictedValue < 0) {
        updateRiskFormState(matchId, category, (form) => ({
          ...form,
          error: t("predictions.riskPredictedTotal"),
        }));
        return;
      }

      if (pointsRisked > availableBalance) {
        updateRiskFormState(matchId, category, (form) => ({
          ...form,
          error: t("predictions.riskInsufficientBalance"),
        }));
        return;
      }

      updateRiskFormState(matchId, category, (form) => ({
        ...form,
        submitting: true,
        error: null,
      }));

      try {
        const res = await fetch(`/api/groups/${groupId}/predictions/risk`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId, category, predictedValue, pointsRisked }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error === "Insufficient available balance"
              ? t("predictions.riskInsufficientBalance")
              : data.error || t("predictions.failedToSave"),
          );
        }

        const savedRisk: RiskPredictionData = data.riskPrediction;
        setRiskPredictions((prev) => ({
          ...prev,
          [matchId]: [
            ...(prev[matchId] ?? []).filter((risk) => risk.category !== category),
            savedRisk,
          ],
        }));
        setAvailableBalance((balance) =>
          typeof data.balance === "number" ? data.balance : Math.max(balance - pointsRisked, 0),
        );
        updateRiskFormState(matchId, category, {
          enabled: true,
          pointsRisked: String(savedRisk.pointsRisked),
          predictedValue: String(savedRisk.predictedValue),
          submitting: false,
          error: null,
        });
      } catch (err) {
        console.error("Failed to save risk prediction:", err);
        updateRiskFormState(matchId, category, (form) => ({
          ...form,
          submitting: false,
          error: err instanceof Error ? err.message : t("predictions.failedToSave"),
        }));
      }
    },
    [availableBalance, getRiskFormState, groupId, t, updateRiskFormState],
  );

  const handleRiskCancel = useCallback(
    async (matchId: string, risk: RiskPredictionData) => {
      updateRiskFormState(matchId, risk.category, (form) => ({
        ...form,
        submitting: true,
        error: null,
      }));

      try {
        const res = await fetch(`/api/groups/${groupId}/predictions/risk/${risk.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || t("predictions.failedToSave"));
        }

        setRiskPredictions((prev) => {
          const next = (prev[matchId] ?? []).filter((entry) => entry.id !== risk.id);
          return { ...prev, [matchId]: next };
        });
        setAvailableBalance((balance) =>
          typeof data.balance === "number" ? data.balance : balance + risk.pointsRisked,
        );
        updateRiskFormState(matchId, risk.category, EMPTY_RISK_FORM);
      } catch (err) {
        console.error("Failed to cancel risk prediction:", err);
        updateRiskFormState(matchId, risk.category, (form) => ({
          ...form,
          submitting: false,
          error: err instanceof Error ? err.message : t("predictions.failedToSave"),
        }));
      }
    },
    [groupId, t, updateRiskFormState],
  );

  /* ---- Cleanup debounce timers ---- */
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  /* ---- Render ---- */
  const selectedRound = rounds.find((r) => r.key === selectedRoundKey) ?? null;
  const roundIdx = selectedRound ? rounds.indexOf(selectedRound) : -1;

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
              fetchMatches(selectedRound);
              fetchPredictions();
              if (riskEnabled) fetchRiskPredictions();
            }}
            className="ml-2 underline"
          >
            {t("predictions.retry")}
          </button>
        </div>
      )}
      {/* Podium predictions — shown at top when enabled */}
      {hasPodium && <PodiumSection groupId={groupId} />}

      {/* Multi-group sync banner */}
      {hasMultipleGroups && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
              />
            </svg>
            <span>
              {t("predictions.multiGroupInfo", {
                count: String(siblingGroups.length),
                groups: siblingGroups.map((g) => g.name).join(", "),
              })}
            </span>
          </div>
          <button
            onClick={syncAllPredictions}
            disabled={syncAllStatus === "syncing"}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              syncAllStatus === "synced"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : syncAllStatus === "error"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-600"
            }`}
          >
            {syncAllStatus === "syncing" && (
              <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
            )}
            {syncAllStatus === "synced" && "✓"}
            {syncAllStatus === "syncing"
              ? t("predictions.syncing")
              : syncAllStatus === "synced"
                ? t("predictions.syncedAll")
                : syncAllStatus === "error"
                  ? t("predictions.syncFailed")
                  : t("predictions.syncAll")}
          </button>
        </div>
      )}

      {/* Round navigation */}
      {rounds.length > 1 && (
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => roundIdx > 0 && handleRoundChange(rounds[roundIdx - 1])}
            disabled={roundIdx <= 0}
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
              {selectedRound?.type === "matchDay"
                ? t("predictions.matchDay", { n: selectedRound.matchDay ?? 0 })
                : t("predictions.playoffRound", { label: selectedRound?.label ?? "" })}
            </span>
            {/* Quick-jump select */}
            <select
              value={selectedRoundKey ?? ""}
              onChange={(e) => {
                const round = rounds.find((r) => r.key === e.target.value);
                if (round) handleRoundChange(round);
              }}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {rounds.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.type === "matchDay"
                    ? t("predictions.mdShort", { n: r.matchDay ?? 0 })
                    : r.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => roundIdx < rounds.length - 1 && handleRoundChange(rounds[roundIdx + 1])}
            disabled={roundIdx >= rounds.length - 1}
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
                const matchRisks = riskPredictions[match.id] ?? [];
                const pendingRisks = matchRisks.filter((risk) => risk.status === "PENDING");
                const showLockedRisks = locked && pendingRisks.length > 0;
                const riskOpen = riskExpandedMatches.has(match.id) || showLockedRisks;
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
                        {/* Per-match sync button */}
                        {hasMultipleGroups && !locked && pred && (
                          <button
                            onClick={() => syncPredictionToAllGroups(match.id)}
                            disabled={matchSyncStatuses[match.id] === "syncing"}
                            title={t("predictions.syncMatch")}
                            className={`rounded p-0.5 transition-colors ${
                              matchSyncStatuses[match.id] === "synced"
                                ? "text-emerald-500"
                                : matchSyncStatuses[match.id] === "error"
                                  ? "text-red-500"
                                  : matchSyncStatuses[match.id] === "syncing"
                                    ? "text-blue-400"
                                    : "text-zinc-400 hover:text-blue-500 dark:text-zinc-500 dark:hover:text-blue-400"
                            }`}
                          >
                            {matchSyncStatuses[match.id] === "syncing" ? (
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border border-blue-300 border-t-blue-600" />
                            ) : matchSyncStatuses[match.id] === "synced" ? (
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m4.5 12.75 6 6 9-13.5"
                                />
                              </svg>
                            ) : (
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
                                  d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                                />
                              </svg>
                            )}
                          </button>
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
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={pred?.homeGoals ?? ""}
                          onChange={(e) => handleScoreChange(match.id, "home", e.target.value)}
                          onFocus={handleScoreFocus}
                          onBlur={() => handleScoreBlur(match.id, "home")}
                          disabled={locked}
                          placeholder="-"
                          className={`h-10 w-12 rounded-lg border text-center text-lg font-bold
                      ${
                        locked
                          ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                          : "border-zinc-300 bg-white text-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      }`}
                          aria-label={t("predictions.homeScore", {
                            home: match.homeTeam.name,
                            away: match.awayTeam.name,
                          })}
                        />
                        <span className="mx-1 text-sm font-medium text-zinc-400">–</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={pred?.awayGoals ?? ""}
                          onChange={(e) => handleScoreChange(match.id, "away", e.target.value)}
                          onFocus={handleScoreFocus}
                          onBlur={() => handleScoreBlur(match.id, "away")}
                          disabled={locked}
                          placeholder="-"
                          className={`h-10 w-12 rounded-lg border text-center text-lg font-bold
                      ${
                        locked
                          ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                          : "border-zinc-300 bg-white text-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      }`}
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

                    {riskEnabled && !locked && (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => toggleRiskSection(match.id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
                        >
                          <span aria-hidden="true">🎲</span>
                          {t("predictions.riskMore")}
                        </button>
                      </div>
                    )}

                    {riskEnabled && riskOpen && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                            {t("predictions.riskMore")}
                          </span>
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            {t("predictions.riskAvailable", {
                              points: String(availableBalance),
                            })}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {(locked
                            ? RISK_OPTIONS.filter((option) =>
                                pendingRisks.some((risk) => risk.category === option.category),
                              )
                            : RISK_OPTIONS
                          ).map((option) => {
                            const existingRisk =
                              pendingRisks.find((risk) => risk.category === option.category) ??
                              null;
                            const formState = getRiskFormState(match.id, option.category);
                            const rowOpen = Boolean(existingRisk) || formState.enabled;
                            const rowDisabled = Boolean(existingRisk) || locked;
                            const pointsValue = existingRisk
                              ? String(existingRisk.pointsRisked)
                              : formState.pointsRisked;
                            const predictedValue = existingRisk
                              ? String(existingRisk.predictedValue)
                              : formState.predictedValue;

                            return (
                              <div
                                key={option.category}
                                className={`rounded-lg border p-3 ${
                                  existingRisk
                                    ? "border-amber-400 bg-white shadow-sm dark:border-amber-700 dark:bg-zinc-900/70"
                                    : "border-amber-100 bg-white/80 dark:border-amber-900/40 dark:bg-zinc-900/50"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base" aria-hidden="true">
                                      {option.icon}
                                    </span>
                                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                      {t(option.labelKey)}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {existingRisk && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                        <svg
                                          className="h-3 w-3"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth={1.8}
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                                          />
                                        </svg>
                                        {locked
                                          ? t("predictions.riskPending")
                                          : t("predictions.riskConfirmed")}
                                      </span>
                                    )}

                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={rowOpen}
                                      aria-label={t(option.labelKey)}
                                      disabled={rowDisabled}
                                      onClick={() => handleRiskToggle(match.id, option.category)}
                                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        rowOpen
                                          ? "bg-amber-500 dark:bg-amber-600"
                                          : "bg-zinc-300 dark:bg-zinc-700"
                                      } ${rowDisabled ? "cursor-not-allowed opacity-70" : ""}`}
                                    >
                                      <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                          rowOpen ? "translate-x-6" : "translate-x-1"
                                        }`}
                                      />
                                    </button>
                                  </div>
                                </div>

                                {rowOpen && (
                                  <div className="mt-3 space-y-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                        <span>{t("predictions.riskPointsToRisk")}</span>
                                        <input
                                          type="number"
                                          min={1}
                                          max={Math.max(availableBalance, 1)}
                                          value={pointsValue}
                                          disabled={Boolean(existingRisk) || formState.submitting}
                                          onChange={(e) =>
                                            handleRiskInputChange(
                                              match.id,
                                              option.category,
                                              "pointsRisked",
                                              e.target.value,
                                            )
                                          }
                                          className={`h-10 w-full rounded-lg border px-3 text-sm font-semibold ${
                                            existingRisk
                                              ? "cursor-not-allowed border-amber-200 bg-amber-100/70 text-zinc-600 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-zinc-300"
                                              : "border-amber-200 bg-white text-zinc-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-900/40 dark:bg-zinc-800 dark:text-zinc-100"
                                          }`}
                                        />
                                      </label>

                                      <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                        <span>{t("predictions.riskPredictedTotal")}</span>
                                        <input
                                          type="number"
                                          min={0}
                                          value={predictedValue}
                                          disabled={Boolean(existingRisk) || formState.submitting}
                                          onChange={(e) =>
                                            handleRiskInputChange(
                                              match.id,
                                              option.category,
                                              "predictedValue",
                                              e.target.value,
                                            )
                                          }
                                          className={`h-10 w-full rounded-lg border px-3 text-sm font-semibold ${
                                            existingRisk
                                              ? "cursor-not-allowed border-amber-200 bg-amber-100/70 text-zinc-600 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-zinc-300"
                                              : "border-amber-200 bg-white text-zinc-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-900/40 dark:bg-zinc-800 dark:text-zinc-100"
                                          }`}
                                        />
                                      </label>
                                    </div>

                                    {!existingRisk && availableBalance < 1 && (
                                      <p className="text-xs text-red-600 dark:text-red-400">
                                        {t("predictions.riskInsufficientBalance")}
                                      </p>
                                    )}
                                    {formState.error && (
                                      <p className="text-xs text-red-600 dark:text-red-400">
                                        {formState.error}
                                      </p>
                                    )}

                                    <div className="flex justify-end">
                                      {existingRisk ? (
                                        !locked && (
                                          <button
                                            type="button"
                                            onClick={() => handleRiskCancel(match.id, existingRisk)}
                                            disabled={formState.submitting}
                                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/30"
                                          >
                                            {t("predictions.riskCancel")}
                                          </button>
                                        )
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRiskConfirm(match.id, option.category)
                                          }
                                          disabled={formState.submitting || availableBalance < 1}
                                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-500"
                                        >
                                          {t("predictions.riskConfirm")}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
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

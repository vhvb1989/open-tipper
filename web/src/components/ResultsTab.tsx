"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useLive, useLiveMatch } from "./LiveProvider";
import { LiveBadge } from "./LiveBadge";
import BadgePopover from "./BadgePopover";
import { useTranslation } from "@/i18n/TranslationProvider";
import type { Round } from "@/lib/rounds";

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
  bonusPoints: number;
  isBackfilled: boolean;
  breakdown: {
    exactScore: number;
    goalDifference: number;
    outcome: number;
    oneTeamGoals: number;
    totalGoals: number;
    reverseGoalDifference: number;
  } | null;
  riskPredictions: RiskPredictionEntry[];
  totalPointsRisked: number;
  riskNetPoints: number;
}

interface RiskPredictionEntry {
  category: "YELLOW_CARDS" | "RED_CARDS" | "CORNER_KICKS" | "OFFSIDES";
  predictedValue: number;
  pointsRisked: number;
  status: "PENDING" | "WON" | "LOST" | "CANCELLED";
  pointsAwarded: number | null;
}

interface MatchStatsSummary {
  yellowCards: number | null;
  redCards: number | null;
  cornerKicks: number | null;
  offsides: number | null;
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
  matchStats?: MatchStatsSummary;
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

function isFinishedMatch(match: MatchResult): boolean {
  return match.status === "FINISHED" || match.status === "AWARDED";
}

function hasAnyMatchStats(stats?: MatchStatsSummary): stats is MatchStatsSummary {
  return Boolean(
    stats &&
    [stats.yellowCards, stats.redCards, stats.cornerKicks, stats.offsides].some(
      (value) => value !== null,
    ),
  );
}

function getRiskActualValue(
  category: RiskPredictionEntry["category"],
  stats?: MatchStatsSummary,
): number | null {
  if (!stats) return null;
  if (category === "YELLOW_CARDS") return stats.yellowCards;
  if (category === "RED_CARDS") return stats.redCards;
  if (category === "CORNER_KICKS") return stats.cornerKicks;
  return stats.offsides;
}

const RISK_STAT_ITEMS: Array<{
  key: keyof MatchStatsSummary;
  icon: string;
  titleKey: string;
}> = [
  { key: "yellowCards", icon: "🟨", titleKey: "results.riskYellowCards" },
  { key: "redCards", icon: "🟥", titleKey: "results.riskRedCards" },
  { key: "cornerKicks", icon: "🚩", titleKey: "results.riskCornerKicks" },
  { key: "offsides", icon: "⚑", titleKey: "results.riskOffsides" },
];

/** Scoring factor badge definitions */
const FACTOR_BADGES: Array<{
  key: keyof NonNullable<PredictionEntry["breakdown"]>;
  labelKey: string;
  titleKey: string;
  descKey: string;
  color: string;
}> = [
  {
    key: "exactScore",
    labelKey: "results.exactScoreShort",
    titleKey: "results.exactScore",
    descKey: "results.exactScoreDesc",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  {
    key: "goalDifference",
    labelKey: "results.goalDifferenceShort",
    titleKey: "results.goalDifference",
    descKey: "results.goalDifferenceDesc",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    key: "outcome",
    labelKey: "results.outcomeShort",
    titleKey: "results.outcome",
    descKey: "results.outcomeDesc",
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  {
    key: "oneTeamGoals",
    labelKey: "results.oneTeamGoalsShort",
    titleKey: "results.oneTeamGoals",
    descKey: "results.oneTeamGoalsDesc",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  {
    key: "totalGoals",
    labelKey: "results.totalGoalsShort",
    titleKey: "results.totalGoals",
    descKey: "results.totalGoalsDesc",
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  },
  {
    key: "reverseGoalDifference",
    labelKey: "results.reverseGoalDiffShort",
    titleKey: "results.reverseGoalDiff",
    descKey: "results.reverseGoalDiffDesc",
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
        <BadgePopover
          key={badge.key}
          title={t(badge.titleKey)}
          description={t(badge.descKey)}
          points={t("results.factorTooltip", {
            factor: t(badge.titleKey),
            points: String(breakdown[badge.key]),
          })}
          badge={
            <span
              className={`inline-flex items-center rounded px-1 py-0.5 text-[10px] font-bold leading-none ${badge.color}`}
            >
              {t(badge.labelKey)}
            </span>
          }
        />
      ))}
    </div>
  );
}

function MatchStatsBadges({ stats }: { stats: MatchStatsSummary }) {
  const { t } = useTranslation();

  return (
    <div className="mt-1 flex flex-wrap items-center justify-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
      {RISK_STAT_ITEMS.map(({ key, icon, titleKey }) => {
        const value = stats[key];
        if (value === null) return null;

        return (
          <span
            key={key}
            title={t(titleKey)}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800"
          >
            <span aria-hidden="true">{icon}</span>
            <span>{value}</span>
          </span>
        );
      })}
    </div>
  );
}

function RiskDetails({
  riskPredictions,
  matchStats,
}: {
  riskPredictions: RiskPredictionEntry[];
  matchStats?: MatchStatsSummary;
}) {
  const { t } = useTranslation();

  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2 font-medium">{t("results.riskCategory")}</th>
            <th className="px-3 py-2 font-medium">{t("results.riskPredicted")}</th>
            <th className="px-3 py-2 font-medium">{t("results.riskActual")}</th>
            <th className="px-3 py-2 font-medium">{t("results.riskPointsRisked")}</th>
            <th className="px-3 py-2 font-medium">{t("results.riskResult")}</th>
          </tr>
        </thead>
        <tbody>
          {riskPredictions.map((risk) => {
            const actual = getRiskActualValue(risk.category, matchStats);
            let resultLabel = t("results.riskPending");
            let resultClass = "text-zinc-500 dark:text-zinc-400";

            if (risk.status === "WON") {
              resultLabel = "✓";
              resultClass = "text-emerald-600 dark:text-emerald-400";
            } else if (risk.status === "LOST") {
              resultLabel = "✗";
              resultClass = "text-red-600 dark:text-red-400";
            } else if (risk.status === "CANCELLED") {
              resultLabel = t("results.riskCancelled");
            }

            return (
              <tr key={risk.category} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2">{t(`results.riskCategories.${risk.category}`)}</td>
                <td className="px-3 py-2">
                  {risk.category === "RED_CARDS"
                    ? t(risk.predictedValue >= 1 ? "results.riskRedYes" : "results.riskRedNo")
                    : risk.predictedValue}
                </td>
                <td className="px-3 py-2">
                  {actual === null
                    ? "—"
                    : risk.category === "RED_CARDS"
                      ? t(actual >= 1 ? "results.riskRedYes" : "results.riskRedNo")
                      : actual}
                </td>
                <td className="px-3 py-2">{t("results.points", { n: risk.pointsRisked })}</td>
                <td className={`px-3 py-2 font-semibold ${resultClass}`}>{resultLabel}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PredictionRow({
  pred,
  match,
  isRiskExpanded,
  onToggleRisk,
}: {
  pred: PredictionEntry;
  match: MatchResult;
  isRiskExpanded: boolean;
  onToggleRisk: () => void;
}) {
  const { t } = useTranslation();
  const exact = isExactHit(pred, match);
  const hasResolvedRisk = pred.riskPredictions.some(
    (risk) => risk.status === "WON" || risk.status === "LOST",
  );
  const showRiskNetBadge = hasResolvedRisk && pred.riskNetPoints !== 0;

  return (
    <div className={`px-4 py-2.5 ${pointsBgClass(pred.pointsAwarded)}`}>
      <div className="flex items-center justify-between gap-3">
        {/* User info */}
        <div className="flex min-w-0 items-center gap-2">
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
          <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">
            {pred.userName ?? t("results.unknown")}
          </span>
        </div>

        {/* Prediction + breakdown + points */}
        <div className="flex flex-wrap items-center justify-end gap-2">
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
            {showRiskNetBadge && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  pred.riskNetPoints > 0
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {pred.riskNetPoints > 0 ? "+" : ""}
                {pred.riskNetPoints}Risk
              </span>
            )}
            {pred.bonusPoints > 0 && (
              <span
                className="text-xs font-semibold text-amber-600 dark:text-amber-400"
                title={t("results.bonusTooltip", {
                  points: String(pred.bonusPoints),
                })}
              >
                +{pred.bonusPoints}★
              </span>
            )}
          </div>
        </div>
      </div>

      {pred.riskPredictions.length > 0 && (
        <div className="mt-2 pl-8">
          <button
            type="button"
            onClick={onToggleRisk}
            className="text-xs font-medium text-zinc-600 underline underline-offset-2 dark:text-zinc-300"
          >
            {isRiskExpanded ? t("results.hideRisk") : t("results.showRisk")} (
            {t("results.points", { n: pred.totalPointsRisked })})
          </button>
          {isRiskExpanded && (
            <RiskDetails riskPredictions={pred.riskPredictions} matchStats={match.matchStats} />
          )}
        </div>
      )}
    </div>
  );
}

function PredictionList({
  predictions,
  match,
  expandedRiskRows,
  onToggleRisk,
}: {
  predictions: PredictionEntry[];
  match: MatchResult;
  expandedRiskRows: Set<string>;
  onToggleRisk: (key: string) => void;
}) {
  const { t } = useTranslation();
  const real = predictions.filter((p) => !p.isBackfilled);
  const backfilled = predictions.filter((p) => p.isBackfilled);

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {real.map((pred) => (
        <PredictionRow
          key={pred.userId}
          pred={pred}
          match={match}
          isRiskExpanded={expandedRiskRows.has(`${match.id}:${pred.userId}`)}
          onToggleRisk={() => onToggleRisk(`${match.id}:${pred.userId}`)}
        />
      ))}
      {backfilled.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-4 py-1.5">
            <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-600" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {t("results.defaultScoreSeparator")}
            </span>
            <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-600" />
          </div>
          {backfilled.map((pred) => (
            <PredictionRow
              key={pred.userId}
              pred={pred}
              match={match}
              isRiskExpanded={expandedRiskRows.has(`${match.id}:${pred.userId}`)}
              onToggleRisk={() => onToggleRisk(`${match.id}:${pred.userId}`)}
            />
          ))}
        </>
      )}
    </div>
  );
}

/* ---------- Component ---------- */

function MatchScore({ match, showRiskStats }: { match: MatchResult; showRiskStats: boolean }) {
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
      {showRiskStats && match.matchStats && hasAnyMatchStats(match.matchStats) && (
        <MatchStatsBadges stats={match.matchStats} />
      )}
    </div>
  );
}

export default function ResultsTab({ groupId }: { groupId: string }) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundKey, setSelectedRoundKey] = useState<string | null>(null);
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set());
  const [expandedRiskRows, setExpandedRiskRows] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskEnabled, setRiskEnabled] = useState(false);
  const [uniqueBonus, setUniqueBonus] = useState<{
    enabled: boolean;
    multiplier: number;
  } | null>(null);
  const { scoresVersion } = useLive();
  const { t } = useTranslation();

  /* ---- Build URL for a round ---- */
  const buildResultsUrl = useCallback(
    (round?: Round | null) => {
      let url = `/api/groups/${groupId}/results`;
      if (round?.type === "matchDay" && round.matchDay != null) {
        url += `?matchDay=${round.matchDay}`;
      } else if (round?.type === "playoff" && round.stage) {
        url += `?stage=${encodeURIComponent(round.stage)}`;
      }
      return url;
    },
    [groupId],
  );

  const fetchResults = useCallback(
    async (round?: Round | null) => {
      setLoading(true);
      try {
        const url = buildResultsUrl(round);
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch results");
        const data = await res.json();
        setResults(data.results);
        if (data.rounds) setRounds(data.rounds);
        if (data.uniqueBonus) setUniqueBonus(data.uniqueBonus);
        setRiskEnabled(Boolean(data.riskEnabled));
        if (selectedRoundKey === null && data.rounds && data.rounds.length > 0) {
          // Default to the latest played round
          setSelectedRoundKey(data.rounds[data.rounds.length - 1].key);
        }
      } catch (err) {
        console.error("Failed to load results:", err);
        setError("Failed to load results. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [selectedRoundKey, buildResultsUrl],
  );

  useEffect(() => {
    fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh when predictions are scored (via SSE)
  useEffect(() => {
    if (scoresVersion > 0) {
      const round = rounds.find((r) => r.key === selectedRoundKey) ?? null;
      fetchResults(round);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoresVersion]);

  const handleRoundChange = (round: Round) => {
    setSelectedRoundKey(round.key);
    setExpandedMatches(new Set());
    setExpandedRiskRows(new Set());
    fetchResults(round);
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

  const toggleRiskRow = (rowKey: string) => {
    setExpandedRiskRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  };

  const selectedRound = rounds.find((r) => r.key === selectedRoundKey) ?? null;
  const roundIdx = selectedRound ? rounds.indexOf(selectedRound) : -1;

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
              fetchResults(selectedRound);
            }}
            className="ml-2 underline"
          >
            {t("results.retry")}
          </button>
        </div>
      )}

      {/* Unique bonus banner */}
      {uniqueBonus?.enabled && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          ★{" "}
          {t("results.uniqueBonusBanner", {
            multiplier: String(uniqueBonus.multiplier),
          })}
        </div>
      )}

      {/* Round navigation */}
      {rounds.length > 1 && (
        <div className="mb-4 flex items-center justify-between">
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
            {t("results.prev")}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {selectedRound?.type === "matchDay"
                ? t("results.matchDay", { n: selectedRound.matchDay ?? 0 })
                : t("results.playoffRound", { label: selectedRound?.label ?? "" })}
            </span>
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
                  {r.type === "matchDay" ? t("results.mdShort", { n: r.matchDay ?? 0 }) : r.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => roundIdx < rounds.length - 1 && handleRoundChange(rounds[roundIdx + 1])}
            disabled={roundIdx >= rounds.length - 1}
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
          const showRiskStats =
            riskEnabled && isFinishedMatch(match) && hasAnyMatchStats(match.matchStats);

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
                  <MatchScore match={match} showRiskStats={showRiskStats} />

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
                    <PredictionList
                      predictions={match.predictions}
                      match={match}
                      expandedRiskRows={expandedRiskRows}
                      onToggleRisk={toggleRiskRow}
                    />
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

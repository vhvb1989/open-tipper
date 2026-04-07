"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useTranslation } from "@/i18n/TranslationProvider";

/* ---------- Types ---------- */

interface Team {
  id: string;
  name: string;
  crest: string | null;
}

interface PodiumSettings {
  enabled: boolean;
  firstPlacePoints: number;
  secondPlacePoints: number;
  thirdPlacePoints: number;
  thirdPlaceEnabled: boolean;
}

interface UserPrediction {
  firstPlaceTeam: Team | null;
  secondPlaceTeam: Team | null;
  thirdPlaceTeam: Team | null;
  firstPlacePoints: number | null;
  secondPlacePoints: number | null;
  thirdPlacePoints: number | null;
  scoredAt: string | null;
}

interface MemberPrediction {
  user: { id: string; name: string | null; image: string | null };
  firstPlaceTeam: Team | null;
  secondPlaceTeam: Team | null;
  thirdPlaceTeam: Team | null;
  firstPlacePoints: number | null;
  secondPlacePoints: number | null;
  thirdPlacePoints: number | null;
  scoredAt: string | null;
}

interface PodiumBadge {
  userId: string;
  position: "FIRST" | "SECOND" | "THIRD";
  points: number;
  user: { id: string; name: string | null };
}

interface PodiumData {
  podiumSettings: PodiumSettings;
  userPrediction: UserPrediction | null;
  isLocked: boolean;
  teams: Team[];
  allPredictions: MemberPrediction[] | null;
  podiumBadges: PodiumBadge[] | null;
  isComplete: boolean;
}

/* ---------- Badge Component ---------- */

const PODIUM_BADGES = [
  {
    position: "FIRST" as const,
    labelKey: "podium.badge1P",
    titleKey: "podium.badge1PTitle",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    emoji: "🥇",
  },
  {
    position: "SECOND" as const,
    labelKey: "podium.badge2P",
    titleKey: "podium.badge2PTitle",
    color: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
    emoji: "🥈",
  },
  {
    position: "THIRD" as const,
    labelKey: "podium.badge3P",
    titleKey: "podium.badge3PTitle",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    emoji: "🥉",
  },
];

function PodiumBadges({
  badges,
  userId,
}: {
  badges: PodiumBadge[];
  userId: string;
}) {
  const { t } = useTranslation();
  const userBadges = badges.filter((b) => b.userId === userId);
  if (userBadges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {userBadges.map((badge) => {
        const config = PODIUM_BADGES.find((b) => b.position === badge.position);
        if (!config) return null;
        return (
          <span
            key={badge.position}
            title={t("podium.badgeTooltip", { badge: t(config.titleKey), points: badge.points })}
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${config.color}`}
          >
            {config.emoji}
            {t(config.labelKey)}
          </span>
        );
      })}
    </div>
  );
}

/* ---------- Team Selector ---------- */

function TeamSelector({
  label,
  teams,
  selectedTeamId,
  excludeTeamIds,
  onChange,
  disabled,
  points,
  isCorrect,
}: {
  label: string;
  teams: Team[];
  selectedTeamId: string | null;
  excludeTeamIds: string[];
  onChange: (teamId: string) => void;
  disabled: boolean;
  points?: number | null;
  isCorrect?: boolean;
}) {
  const { t } = useTranslation();
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const availableTeams = teams.filter(
    (t) => !excludeTeamIds.includes(t.id) || t.id === selectedTeamId,
  );

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
        {points !== undefined && points !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              isCorrect
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {isCorrect && "✓ "}
            {t("podium.points", { n: points })}
          </span>
        )}
      </div>

      {disabled && selectedTeam ? (
        <div className="mt-2 flex items-center gap-2">
          {selectedTeam.crest && (
            <Image
              src={selectedTeam.crest}
              alt=""
              width={24}
              height={24}
              className="h-6 w-6"
              unoptimized
            />
          )}
          <span className="text-sm text-zinc-900 dark:text-zinc-100">{selectedTeam.name}</span>
        </div>
      ) : (
        <select
          value={selectedTeamId ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="mt-2 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="">{t("podium.selectTeam")}</option>
          {availableTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/* ---------- Main Component ---------- */

export default function PodiumTab({
  groupId,
  currentUserId,
}: {
  groupId: string;
  currentUserId: string;
}) {
  const [data, setData] = useState<PodiumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Local form state
  const [firstTeamId, setFirstTeamId] = useState<string | null>(null);
  const [secondTeamId, setSecondTeamId] = useState<string | null>(null);
  const [thirdTeamId, setThirdTeamId] = useState<string | null>(null);

  const { t } = useTranslation();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/podium`);
      if (!res.ok) throw new Error("Failed to fetch");
      const d: PodiumData = await res.json();
      setData(d);
      if (d.userPrediction) {
        setFirstTeamId(d.userPrediction.firstPlaceTeam?.id ?? null);
        setSecondTeamId(d.userPrediction.secondPlaceTeam?.id ?? null);
        setThirdTeamId(d.userPrediction.thirdPlaceTeam?.id ?? null);
      }
    } catch {
      setError(t("podium.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const savePrediction = useCallback(
    async (first: string, second: string, third: string | null) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/groups/${groupId}/podium`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstPlaceTeamId: first,
            secondPlaceTeamId: second,
            thirdPlaceTeamId: third,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to save");
        }
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    },
    [groupId],
  );

  // Auto-save when selections change
  const handleTeamChange = (
    position: "first" | "second" | "third",
    teamId: string,
  ) => {
    const newFirst = position === "first" ? teamId : firstTeamId;
    const newSecond = position === "second" ? teamId : secondTeamId;
    const newThird = position === "third" ? teamId : thirdTeamId;

    if (position === "first") setFirstTeamId(teamId);
    if (position === "second") setSecondTeamId(teamId);
    if (position === "third") setThirdTeamId(teamId);

    // Save if at least 1st and 2nd are selected
    if (newFirst && newSecond) {
      savePrediction(newFirst, newSecond, newThird || null);
    }
  };

  /* ---- Render ---- */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-red-300 px-8 py-16 text-center dark:border-red-700">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={() => {
            setError(null);
            fetchData();
          }}
          className="mt-2 text-sm underline"
        >
          {t("podium.retry")}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { podiumSettings, isLocked, teams, allPredictions, podiumBadges } = data;
  const isScored = !!data.userPrediction?.scoredAt || (allPredictions?.some((p) => p.scoredAt) ?? false);
  const excludeFirst = [secondTeamId, thirdTeamId].filter(Boolean) as string[];
  const excludeSecond = [firstTeamId, thirdTeamId].filter(Boolean) as string[];
  const excludeThird = [firstTeamId, secondTeamId].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {t("podium.heading")}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {t("podium.description")}
        </p>
      </div>

      {/* Lock / Save status */}
      {isLocked ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          {t("podium.lockedNote")}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("podium.unlockNote")}
          </p>
          {saveStatus !== "idle" && (
            <span
              className={`text-xs ${
                saveStatus === "saving"
                  ? "text-zinc-400"
                  : saveStatus === "saved"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
              }`}
            >
              {saveStatus === "saving"
                ? t("podium.saving")
                : saveStatus === "saved"
                  ? t("podium.saved")
                  : t("podium.failedToSave")}
            </span>
          )}
        </div>
      )}

      {/* Prediction selectors (or read-only view) */}
      {!isScored && (
        <div className="space-y-3">
          <TeamSelector
            label={t("podium.firstPlace")}
            teams={teams}
            selectedTeamId={firstTeamId}
            excludeTeamIds={excludeFirst}
            onChange={(id) => handleTeamChange("first", id)}
            disabled={isLocked}
          />
          <TeamSelector
            label={t("podium.secondPlace")}
            teams={teams}
            selectedTeamId={secondTeamId}
            excludeTeamIds={excludeSecond}
            onChange={(id) => handleTeamChange("second", id)}
            disabled={isLocked}
          />
          {podiumSettings.thirdPlaceEnabled && (
            <TeamSelector
              label={t("podium.thirdPlace")}
              teams={teams}
              selectedTeamId={thirdTeamId}
              excludeTeamIds={excludeThird}
              onChange={(id) => handleTeamChange("third", id)}
              disabled={isLocked}
            />
          )}
        </div>
      )}

      {/* Not scored yet but locked */}
      {isLocked && !isScored && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
          {t("podium.notScoredYet")}
        </p>
      )}

      {/* Scored results */}
      {isScored && allPredictions && (
        <div className="space-y-4">
          <h3 className="text-md font-semibold text-zinc-900 dark:text-zinc-50">
            {t("podium.memberPredictions")}
          </h3>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3">{t("podium.firstPlace")}</th>
                  <th className="px-4 py-3">{t("podium.secondPlace")}</th>
                  {podiumSettings.thirdPlaceEnabled && (
                    <th className="px-4 py-3">{t("podium.thirdPlace")}</th>
                  )}
                  <th className="px-4 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {allPredictions.map((pred) => {
                  const isCurrentUser = pred.user.id === currentUserId;
                  const total =
                    (pred.firstPlacePoints ?? 0) +
                    (pred.secondPlacePoints ?? 0) +
                    (pred.thirdPlacePoints ?? 0);

                  return (
                    <tr
                      key={pred.user.id}
                      className={`transition-colors ${
                        isCurrentUser
                          ? "bg-blue-50/50 dark:bg-blue-900/10"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {pred.user.image ? (
                            <Image
                              src={pred.user.image}
                              alt=""
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded-full"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                              {(pred.user.name ?? "?")[0]?.toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {pred.user.name ?? "Unknown"}
                            </span>
                            {podiumBadges && (
                              <PodiumBadges badges={podiumBadges} userId={pred.user.id} />
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <TeamCell
                          team={pred.firstPlaceTeam}
                          points={pred.firstPlacePoints}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <TeamCell
                          team={pred.secondPlaceTeam}
                          points={pred.secondPlacePoints}
                        />
                      </td>
                      {podiumSettings.thirdPlaceEnabled && (
                        <td className="px-4 py-3">
                          <TeamCell
                            team={pred.thirdPlaceTeam}
                            points={pred.thirdPlacePoints}
                          />
                        </td>
                      )}

                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-lg font-bold ${
                            total > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-zinc-400 dark:text-zinc-500"
                          }`}
                        >
                          {total}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Helpers ---------- */

function TeamCell({ team, points }: { team: Team | null; points: number | null }) {
  if (!team) return <span className="text-xs text-zinc-400">—</span>;
  const isCorrect = (points ?? 0) > 0;

  return (
    <div className="flex items-center gap-2">
      {team.crest && (
        <Image src={team.crest} alt="" width={20} height={20} className="h-5 w-5" unoptimized />
      )}
      <span
        className={`text-sm ${
          isCorrect
            ? "font-semibold text-emerald-600 dark:text-emerald-400"
            : "text-zinc-700 dark:text-zinc-300"
        }`}
      >
        {team.name}
      </span>
      {isCorrect && (
        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          +{points}
        </span>
      )}
    </div>
  );
}

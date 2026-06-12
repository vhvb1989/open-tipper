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

interface PodiumData {
  podiumSettings: PodiumSettings;
  userPrediction: UserPrediction | null;
  isLocked: boolean;
  teams: Team[];
  isAdmin: boolean;
  podiumOpenOverride: boolean | null;
}

/* ---------- Team Picker Popup ---------- */

function TeamPickerPopup({
  teams,
  excludeTeamIds,
  onSelect,
  onClose,
}: {
  teams: Team[];
  excludeTeamIds: string[];
  onSelect: (teamId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const available = teams.filter((t) => !excludeTeamIds.includes(t.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {t("podium.selectTeam")}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {available.map((team) => (
            <button
              key={team.id}
              onClick={() => {
                onSelect(team.id);
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {team.crest ? (
                <Image
                  src={team.crest}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0"
                  unoptimized
                />
              ) : (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                  {team.name[0]}
                </div>
              )}
              <span>{team.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Position Slot ---------- */

function PodiumSlot({
  label,
  emoji,
  team,
  disabled,
  onPickClick,
  colorClass,
}: {
  label: string;
  emoji: string;
  team: Team | null;
  disabled: boolean;
  onPickClick: () => void;
  colorClass: string;
}) {
  const { t } = useTranslation();

  return (
    <button
      onClick={onPickClick}
      disabled={disabled}
      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default ${colorClass}`}
    >
      <span className="text-base">{emoji}</span>
      {team ? (
        <div className="flex items-center gap-2">
          {team.crest && (
            <Image
              src={team.crest}
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 shrink-0"
              unoptimized
            />
          )}
          <span className="font-medium">{team.name}</span>
        </div>
      ) : (
        <span className="text-zinc-400 dark:text-zinc-500">
          {label} — {t("podium.selectTeam")}
        </span>
      )}
    </button>
  );
}

/* ---------- Admin Override Toggle ---------- */

function PodiumOverrideToggle({
  currentOverride,
  groupId,
  onUpdated,
}: {
  currentOverride: boolean | null;
  groupId: string;
  onUpdated: () => void;
}) {
  const { t } = useTranslation();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(false);

  const options: { value: boolean | null; labelKey: string }[] = [
    { value: null, labelKey: "podium.overrideAuto" },
    { value: true, labelKey: "podium.overrideOpen" },
    { value: false, labelKey: "podium.overrideClosed" },
  ];

  const hintKey =
    currentOverride === true
      ? "podium.overrideOpenHint"
      : currentOverride === false
        ? "podium.overrideClosedHint"
        : "podium.overrideAutoHint";

  const handleChange = async (value: boolean | null) => {
    setUpdating(true);
    setError(false);
    try {
      const res = await fetch(`/api/groups/${groupId}/podium`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podiumOpenOverride: value }),
      });
      if (!res.ok) throw new Error("Failed");
      onUpdated();
    } catch {
      setError(true);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <svg
            className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
            />
          </svg>
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            {t("podium.adminOverride")}
          </span>
        </div>
        <div className="flex items-center gap-0.5 rounded-md border border-zinc-200 bg-white p-0.5 dark:border-zinc-600 dark:bg-zinc-800">
          {options.map((opt) => {
            const isActive =
              currentOverride === opt.value ||
              (currentOverride === null && opt.value === null) ||
              (currentOverride === undefined && opt.value === null);
            return (
              <button
                key={String(opt.value)}
                onClick={() => handleChange(opt.value)}
                disabled={updating || isActive}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{t(hintKey)}</p>
      {updating && (
        <p className="mt-0.5 text-[11px] text-zinc-400">{t("podium.overrideUpdating")}</p>
      )}
      {error && (
        <p className="mt-0.5 text-[11px] text-red-600 dark:text-red-400">
          {t("podium.overrideFailed")}
        </p>
      )}
    </div>
  );
}

/* ---------- Main Component ---------- */

export default function PodiumSection({ groupId }: { groupId: string }) {
  const [data, setData] = useState<PodiumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pickerPosition, setPickerPosition] = useState<"first" | "second" | "third" | null>(null);

  const [firstTeamId, setFirstTeamId] = useState<string | null>(null);
  const [secondTeamId, setSecondTeamId] = useState<string | null>(null);
  const [thirdTeamId, setThirdTeamId] = useState<string | null>(null);

  const { t } = useTranslation();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/podium`);
      if (!res.ok) {
        setData(null);
        return;
      }
      const d: PodiumData = await res.json();
      setData(d);
      if (d.userPrediction) {
        setFirstTeamId(d.userPrediction.firstPlaceTeam?.id ?? null);
        setSecondTeamId(d.userPrediction.secondPlaceTeam?.id ?? null);
        setThirdTeamId(d.userPrediction.thirdPlaceTeam?.id ?? null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

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
        if (!res.ok) throw new Error("Failed");
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    },
    [groupId],
  );

  const handleTeamSelect = (position: "first" | "second" | "third", teamId: string) => {
    const newFirst = position === "first" ? teamId : firstTeamId;
    const newSecond = position === "second" ? teamId : secondTeamId;
    const newThird = position === "third" ? teamId : thirdTeamId;

    if (position === "first") setFirstTeamId(teamId);
    if (position === "second") setSecondTeamId(teamId);
    if (position === "third") setThirdTeamId(teamId);

    if (newFirst && newSecond) {
      savePrediction(newFirst, newSecond, newThird || null);
    }
  };

  // Don't render anything while loading or if not enabled
  if (loading || !data) return null;

  const { podiumSettings, isLocked, teams, userPrediction, isAdmin } = data;

  // If locked and user has no prediction and not admin, don't show at all
  if (isLocked && !userPrediction && !isAdmin) return null;

  const firstTeam = teams.find((t) => t.id === firstTeamId) ?? null;
  const secondTeam = teams.find((t) => t.id === secondTeamId) ?? null;
  const thirdTeam = teams.find((t) => t.id === thirdTeamId) ?? null;

  const excludeFor = (pos: "first" | "second" | "third") => {
    const ids: string[] = [];
    if (pos !== "first" && firstTeamId) ids.push(firstTeamId);
    if (pos !== "second" && secondTeamId) ids.push(secondTeamId);
    if (pos !== "third" && thirdTeamId) ids.push(thirdTeamId);
    return ids;
  };

  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🏆</span>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {t("podium.heading")}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="text-xs text-zinc-400">{t("podium.saving")}</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              {t("podium.saved")}
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {t("podium.failedToSave")}
            </span>
          )}
          {isLocked && (
            <svg
              className="h-4 w-4 text-zinc-400 dark:text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
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

      {/* Admin override toggle */}
      {isAdmin && (
        <PodiumOverrideToggle
          currentOverride={data.podiumOpenOverride}
          groupId={groupId}
          onUpdated={fetchData}
        />
      )}

      {!isLocked && (
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">{t("podium.unlockNote")}</p>
      )}

      {/* Slots */}
      <div className="space-y-2">
        <PodiumSlot
          label={t("podium.firstPlace")}
          emoji="🥇"
          team={firstTeam}
          disabled={isLocked}
          onPickClick={() => !isLocked && setPickerPosition("first")}
          colorClass={
            isLocked
              ? "border-zinc-200 dark:border-zinc-700"
              : "border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/20"
          }
        />
        <PodiumSlot
          label={t("podium.secondPlace")}
          emoji="🥈"
          team={secondTeam}
          disabled={isLocked}
          onPickClick={() => !isLocked && setPickerPosition("second")}
          colorClass={
            isLocked
              ? "border-zinc-200 dark:border-zinc-700"
              : "border-zinc-300 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          }
        />
        {podiumSettings.thirdPlaceEnabled && (
          <PodiumSlot
            label={t("podium.thirdPlace")}
            emoji="🥉"
            team={thirdTeam}
            disabled={isLocked}
            onPickClick={() => !isLocked && setPickerPosition("third")}
            colorClass={
              isLocked
                ? "border-zinc-200 dark:border-zinc-700"
                : "border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/20"
            }
          />
        )}
      </div>

      {/* Team Picker Popup */}
      {pickerPosition && (
        <TeamPickerPopup
          teams={teams}
          excludeTeamIds={excludeFor(pickerPosition)}
          onSelect={(teamId) => handleTeamSelect(pickerPosition, teamId)}
          onClose={() => setPickerPosition(null)}
        />
      )}
    </div>
  );
}

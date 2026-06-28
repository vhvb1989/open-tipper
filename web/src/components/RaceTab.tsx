"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "@/i18n/TranslationProvider";
import { rankFrame, maxValue, type RaceUser, type RaceTrajectoryPoint } from "@/lib/race";

/* ---------- Types ---------- */

interface RaceData {
  trajectory: RaceTrajectoryPoint[];
  users: RaceUser[];
}

/* ---------- Color palette (shared with Trajectory) ---------- */

const COLORS = [
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#e11d48",
];

const ROW_HEIGHT = 52;
const SPEEDS = [0.5, 1, 2, 4];

/* ---------- Component ---------- */

export default function RaceTab({ groupId }: { groupId: string }) {
  const [data, setData] = useState<RaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/trajectory`);
      if (!res.ok) throw new Error("Failed to fetch race data");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load race:", err);
      setError(t("race.error"));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const lastStep = data ? data.trajectory.length - 1 : 0;

  // Playback loop: advance one frame per tick until the end.
  useEffect(() => {
    if (!playing || !data) return;
    if (step >= lastStep) {
      setPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => setStep((s) => s + 1), 700 / speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, step, lastStep, speed, data]);

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    data?.users.forEach((u, i) => map.set(u.id, COLORS[i % COLORS.length]));
    return map;
  }, [data]);

  const max = useMemo(() => (data ? maxValue(data.trajectory, data.users) : 1), [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="mt-2 text-sm font-medium text-red-600 underline dark:text-red-400"
        >
          {t("race.retry")}
        </button>
      </div>
    );
  }

  if (!data || data.trajectory.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 px-8 py-16 text-center dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {t("race.noData")}
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t("race.noDataDesc")}</p>
      </div>
    );
  }

  const point = data.trajectory[step];
  const rows = rankFrame(point, data.users);
  const nameFor = (id: string) => data.users.find((u) => u.id === id)?.name ?? t("race.unknown");

  const handlePlay = () => {
    if (step >= lastStep) setStep(0);
    setPlaying((p) => !p);
  };
  const handleRestart = () => {
    setStep(0);
    setPlaying(true);
  };

  return (
    <div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t("race.title")}
        </h3>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">{t("race.hint")}</p>

        {/* Caption: current match */}
        <div className="mb-3 text-center text-sm font-medium text-zinc-600 dark:text-zinc-300">
          {point.matchDay != null
            ? t("race.matchDayLabel", { n: point.matchDay })
            : (point.stage ?? "")}
          {" — "}
          {point.homeTeam} {point.homeGoals ?? "-"} - {point.awayGoals ?? "-"} {point.awayTeam}
        </div>

        {/* Race rows */}
        <div className="relative" style={{ height: data.users.length * ROW_HEIGHT }}>
          {data.users.map((u) => {
            const row = rows.find((r) => r.userId === u.id)!;
            const color = colorMap.get(u.id) ?? COLORS[0];
            const width = 18 + (row.value / max) * 78;
            return (
              <div
                key={u.id}
                className="absolute left-0 right-0 flex h-12 items-center gap-2 transition-transform duration-500 ease-out"
                style={{ transform: `translateY(${row.rank * ROW_HEIGHT}px)` }}
              >
                <span className="w-6 text-right text-sm font-bold text-zinc-400">
                  {row.rank + 1}
                </span>
                <span className="w-20 truncate text-sm text-zinc-700 dark:text-zinc-300">
                  {nameFor(u.id)}
                </span>
                <div className="flex-1">
                  <div
                    className="flex h-8 min-w-[40px] items-center justify-end rounded-md px-2 text-sm font-bold text-white transition-[width] duration-500 ease-out"
                    style={{ width: `${width}%`, backgroundColor: color }}
                  >
                    {row.value}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handlePlay}
            className="rounded-md bg-gold-500 px-4 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-gold-400"
          >
            {playing ? t("race.pause") : t("race.play")}
          </button>
          <button
            onClick={handleRestart}
            className="rounded-md bg-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
          >
            {t("race.restart")}
          </button>
          <input
            type="range"
            min={0}
            max={lastStep}
            value={step}
            onChange={(e) => {
              setPlaying(false);
              setStep(Number(e.target.value));
            }}
            className="h-2 flex-1 cursor-pointer accent-gold-500"
            aria-label={t("race.title")}
          />
          <label className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t("race.speed")}
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="rounded border border-zinc-300 bg-transparent px-1 py-0.5 dark:border-zinc-600"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}x
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

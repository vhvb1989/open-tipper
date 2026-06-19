"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Brush,
} from "recharts";
import { useTranslation } from "@/i18n/TranslationProvider";

/* ---------- Types ---------- */

interface UserInfo {
  id: string;
  name: string | null;
  image: string | null;
}

interface UserMatchData {
  cumulative: number;
  matchPoints: number | null;
  prediction: string | null;
}

interface TrajectoryPoint {
  matchId: string;
  matchDay: number | null;
  stage: string | null;
  kickoffTime: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamCrest: string | null;
  awayTeamCrest: string | null;
  users: Record<string, UserMatchData>;
}

interface TrajectoryData {
  trajectory: TrajectoryPoint[];
  users: UserInfo[];
  currentUserId: string;
}

/* ---------- Color palette ---------- */

const COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#e11d48", // rose
];

function getUserColor(index: number): string {
  return COLORS[index % COLORS.length];
}

/* ---------- Custom Tooltip ---------- */

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
  }>;
  label?: string;
  trajectoryData: TrajectoryPoint[];
  users: UserInfo[];
  highlightedUser: string | null;
}

function CustomTooltip({
  active,
  payload,
  label,
  trajectoryData,
  users,
  highlightedUser,
}: CustomTooltipProps) {
  const { t } = useTranslation();

  if (!active || !payload || !label) return null;

  const pointIndex = parseInt(label, 10);
  const point = trajectoryData[pointIndex];
  if (!point) return null;

  // Show only highlighted user or top entries if no highlight
  const relevantPayload = highlightedUser
    ? payload.filter((p) => p.dataKey === highlightedUser)
    : payload.slice(0, 5);

  return (
    <div className="max-w-[280px] rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      {/* Match info */}
      <div className="mb-2 border-b border-zinc-100 pb-2 dark:border-zinc-800">
        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {point.matchDay != null
            ? t("trajectory.matchDayLabel", { n: point.matchDay })
            : (point.stage ?? "")}
        </div>
        <div className="mt-1 flex items-center justify-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <span>{point.homeTeam}</span>
          <span className="text-zinc-500">
            {point.homeGoals} - {point.awayGoals}
          </span>
          <span>{point.awayTeam}</span>
        </div>
      </div>

      {/* User details */}
      <div className="space-y-1.5">
        {relevantPayload.map((entry) => {
          const user = users.find((u) => u.id === entry.dataKey);
          const userData = point.users[entry.dataKey];
          if (!userData) return null;

          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-zinc-700 dark:text-zinc-300">
                  {user?.name ?? t("trajectory.unknown")}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {userData.prediction && (
                  <span className="text-zinc-500 dark:text-zinc-400">({userData.prediction})</span>
                )}
                <span className="font-medium text-zinc-600 dark:text-zinc-300">
                  {userData.matchPoints != null ? `+${userData.matchPoints}` : "-"}
                </span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  {entry.value} {t("trajectory.pts")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {!highlightedUser && payload.length > 5 && (
        <div className="mt-1 text-center text-[10px] text-zinc-400">
          {t("trajectory.clickLegend")}
        </div>
      )}
    </div>
  );
}

/* ---------- Component ---------- */

export default function TrajectoryTab({ groupId }: { groupId: string }) {
  const [data, setData] = useState<TrajectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightedUser, setHighlightedUser] = useState<string | null>(null);
  const { t } = useTranslation();

  const fetchTrajectory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/trajectory`);
      if (!res.ok) throw new Error("Failed to fetch trajectory");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load trajectory:", err);
      setError(t("trajectory.error"));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    fetchTrajectory();
  }, [fetchTrajectory]);

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
          onClick={fetchTrajectory}
          className="mt-2 text-sm font-medium text-red-600 underline dark:text-red-400"
        >
          {t("trajectory.retry")}
        </button>
      </div>
    );
  }

  if (!data || data.trajectory.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 px-8 py-16 text-center dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {t("trajectory.noData")}
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t("trajectory.noDataDesc")}
        </p>
      </div>
    );
  }

  // Transform data for Recharts: each point is an object with index + userId keys
  const chartData = data.trajectory.map((point, index) => {
    const row: Record<string, unknown> = { index };
    for (const user of data.users) {
      row[user.id] = point.users[user.id]?.cumulative ?? 0;
    }
    return row;
  });

  // Compute unique tick indices: only the first occurrence of each matchDay/stage
  const xTicks: number[] = [];
  const seenLabels = new Set<string>();
  data.trajectory.forEach((point, index) => {
    const label = point.matchDay != null ? `J${point.matchDay}` : (point.stage?.slice(0, 3) ?? "");
    if (!seenLabels.has(label)) {
      seenLabels.add(label);
      xTicks.push(index);
    }
  });

  const userIndexMap = new Map(data.users.map((u, i) => [u.id, i]));

  const handleLegendClick = (entry: {
    dataKey?: string | number | ((obj: unknown) => unknown);
  }) => {
    const key = String(entry.dataKey);
    setHighlightedUser((prev) => (prev === key ? null : key));
  };

  // Default highlight: current user
  const effectiveHighlight = highlightedUser ?? data.currentUserId;

  return (
    <div>
      {/* Chart container */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t("trajectory.title")}
        </h3>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">{t("trajectory.hint")}</p>

        <div className="h-[380px] w-full sm:h-[480px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.2} />
              <XAxis
                dataKey="index"
                tick={{ fontSize: 11 }}
                ticks={xTicks}
                tickFormatter={(value: number) => {
                  const point = data.trajectory[value];
                  if (!point) return "";
                  if (point.matchDay != null) return `J${point.matchDay}`;
                  return point.stage?.slice(0, 3) ?? "";
                }}
                stroke="#a1a1aa"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" width={45} />
              <Tooltip
                content={
                  <CustomTooltip
                    trajectoryData={data.trajectory}
                    users={data.users}
                    highlightedUser={effectiveHighlight}
                  />
                }
              />
              <Legend
                onClick={handleLegendClick}
                wrapperStyle={{ cursor: "pointer", fontSize: "12px", paddingTop: "12px" }}
                formatter={(value: string) => {
                  const user = data.users.find((u) => u.id === value);
                  return user?.name ?? t("trajectory.unknown");
                }}
              />
              {data.users.map((user) => {
                const colorIndex = userIndexMap.get(user.id) ?? 0;
                const isHighlighted = user.id === effectiveHighlight;
                return (
                  <Line
                    key={user.id}
                    type="monotone"
                    dataKey={user.id}
                    name={user.id}
                    stroke={getUserColor(colorIndex)}
                    strokeWidth={isHighlighted ? 3 : 1.5}
                    strokeOpacity={isHighlighted ? 1 : 0.3}
                    dot={isHighlighted}
                    activeDot={{
                      r: isHighlighted ? 6 : 4,
                      onClick: () => setHighlightedUser(user.id),
                      cursor: "pointer",
                    }}
                    connectNulls
                  />
                );
              })}
              <Brush
                dataKey="index"
                height={30}
                stroke="#a1a1aa"
                fill="#27272a"
                tickFormatter={(value: number) => {
                  const point = data.trajectory[value];
                  if (!point) return "";
                  if (point.matchDay != null) return `J${point.matchDay}`;
                  return point.stage?.slice(0, 3) ?? "";
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export interface RaceUser {
  id: string;
  name: string | null;
  image: string | null;
}

export interface RaceTrajectoryPoint {
  matchDay: number | null;
  stage: string | null;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number | null;
  awayGoals: number | null;
  users: Record<string, { cumulative: number }>;
}

export interface RaceFrameRow {
  userId: string;
  value: number;
  rank: number;
}

/** Cumulative value per user at a given frame, ranked descending (rank 0 = leader). */
export function rankFrame(point: RaceTrajectoryPoint, users: RaceUser[]): RaceFrameRow[] {
  const rows = users.map((u) => ({
    userId: u.id,
    value: point.users[u.id]?.cumulative ?? 0,
  }));
  rows.sort((a, b) => b.value - a.value || a.userId.localeCompare(b.userId));
  return rows.map((r, i) => ({ ...r, rank: i }));
}

/** Largest cumulative value across all frames, used to scale bar widths. Min 1. */
export function maxValue(trajectory: RaceTrajectoryPoint[], users: RaceUser[]): number {
  let max = 0;
  for (const point of trajectory) {
    for (const u of users) {
      const v = point.users[u.id]?.cumulative ?? 0;
      if (v > max) max = v;
    }
  }
  return Math.max(max, 1);
}

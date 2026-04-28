/**
 * Round utilities for navigating both regular-season match days and
 * playoff/knockout stages in a unified way.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A navigable round — either a numeric match day or a named playoff stage.
 *
 * `key` is a stable string identifier used for URL params and React state:
 *   - "md:1", "md:2" … for match-day rounds
 *   - "stage:Clausura - Quarter-finals" for playoff rounds (full DB stage value)
 */
export interface Round {
  key: string;
  label: string;
  type: "matchDay" | "playoff";
  matchDay: number | null;
  stage: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the human-readable round suffix from a stage string, stripping any
 * sub-tournament prefix (e.g. "Clausura - Quarter-finals" → "Quarter-finals").
 */
export function getRoundLabel(stage: string): string {
  const sepIdx = stage.indexOf(" - ");
  if (sepIdx > 0) return stage.substring(sepIdx + 3);
  return stage;
}

/**
 * Build an ordered list of navigable rounds from match data.
 *
 * Numeric match days come first (ascending), followed by playoff stages
 * sorted by earliest kickoff time.
 */
export function buildRounds(
  matches: Array<{ matchDay: number | null; stage: string | null; kickoffTime: Date | string }>,
): Round[] {
  const rounds: Round[] = [];

  const matchDaySet = new Set<number>();
  const playoffStages = new Map<string, Date>();

  for (const m of matches) {
    if (m.matchDay != null) {
      matchDaySet.add(m.matchDay);
    } else if (m.stage) {
      const d = new Date(m.kickoffTime);
      const existing = playoffStages.get(m.stage);
      if (!existing || d < existing) {
        playoffStages.set(m.stage, d);
      }
    }
  }

  // Match-day rounds (ascending)
  for (const md of [...matchDaySet].sort((a, b) => a - b)) {
    rounds.push({
      key: `md:${md}`,
      label: String(md),
      type: "matchDay",
      matchDay: md,
      stage: null,
    });
  }

  // Playoff rounds (sorted by earliest kickoff)
  const sorted = [...playoffStages.entries()].sort(([, a], [, b]) => a.getTime() - b.getTime());
  for (const [stage] of sorted) {
    rounds.push({
      key: `stage:${stage}`,
      label: getRoundLabel(stage),
      type: "playoff",
      matchDay: null,
      stage,
    });
  }

  return rounds;
}

/**
 * Result of active-group detection.
 *
 * `activeGroup` — the sub-tournament prefix to filter to, or `null` if no
 * filtering is needed.
 *
 * `nullGroupCutoff` — when set, only null-group matches with kickoff on or
 * after this date should be included. Null-group matches before this date
 * are stale leftovers from a previous sub-tournament. When `null`, all
 * null-group matches are included (or excluded via `activeGroup`).
 */
export interface ActiveGroupResult {
  activeGroup: string | null;
  nullGroupCutoff: Date | null;
}

/**
 * Determine the active sub-tournament group prefix and a date cutoff for
 * null-group matches.
 *
 * Leagues like Liga MX run two tournaments per season (Apertura, Clausura)
 * within the same API-Football "season". The `group` column stores the
 * round prefix (e.g. "Clausura"). Playoff rounds often lack a prefix
 * (e.g. "Quarter-finals" → group = null), making it impossible to tell
 * which sub-tournament they belong to by name alone.
 *
 * The heuristic: use the active group's earliest match date (MD 1) as a
 * cutoff. Null-group matches on or after that date belong to the current
 * sub-tournament; those before it are stale leftovers.
 */
export function getActiveGroupInfo(
  matches: Array<{ group: string | null; kickoffTime: Date | string }>,
): ActiveGroupResult {
  const groupDates = new Map<string, { min: Date; max: Date }>();
  let hasNullGroup = false;

  for (const m of matches) {
    const d = new Date(m.kickoffTime);
    if (!m.group) {
      hasNullGroup = true;
      continue;
    }
    const existing = groupDates.get(m.group);
    if (!existing) {
      groupDates.set(m.group, { min: new Date(d.getTime()), max: new Date(d.getTime()) });
    } else {
      if (d < existing.min) existing.min = d;
      if (d > existing.max) existing.max = d;
    }
  }

  // No non-null groups → no filtering needed
  if (groupDates.size === 0) return { activeGroup: null, nullGroupCutoff: null };

  // Find the group with the latest max date
  let latestGroup = "";
  let latestDate = new Date(0);
  for (const [group, dates] of groupDates) {
    if (dates.max > latestDate) {
      latestDate = dates.max;
      latestGroup = group;
    }
  }

  // No null-group matches → only filter between non-null groups
  if (!hasNullGroup) {
    if (groupDates.size <= 1) return { activeGroup: null, nullGroupCutoff: null };
    return { activeGroup: latestGroup, nullGroupCutoff: null };
  }

  // Null-group matches exist — use the active group's earliest date as cutoff.
  // Null-group matches before that date are from the previous sub-tournament.
  const activeGroupDates = groupDates.get(latestGroup)!;

  if (groupDates.size > 1) {
    return { activeGroup: latestGroup, nullGroupCutoff: activeGroupDates.min };
  }

  // Single non-null group + null-group matches → apply cutoff
  return { activeGroup: latestGroup, nullGroupCutoff: activeGroupDates.min };
}

/**
 * Parse a round key back into filter parameters.
 *
 * Returns `{ matchDay }` for match-day rounds or `{ stage }` for playoffs.
 */
export function parseRoundKey(key: string): { matchDay?: number; stage?: string } {
  if (key.startsWith("md:")) {
    return { matchDay: parseInt(key.slice(3), 10) };
  }
  if (key.startsWith("stage:")) {
    return { stage: key.slice(6) };
  }
  // Fallback: try numeric
  const n = parseInt(key, 10);
  if (!isNaN(n)) return { matchDay: n };
  return { stage: key };
}

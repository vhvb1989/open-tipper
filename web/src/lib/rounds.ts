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
 * `includeNullGroup` — whether matches with `group = null` should be kept.
 * Stale null-group matches (from an older sub-tournament) are excluded;
 * current ones (e.g. standalone knockout rounds) are kept.
 */
export interface ActiveGroupResult {
  activeGroup: string | null;
  includeNullGroup: boolean;
}

/**
 * Determine the active sub-tournament group prefix and whether null-group
 * matches should be included.
 *
 * Leagues like Liga MX run two tournaments per season (Apertura, Clausura)
 * within the same API-Football "season". The `group` column stores the
 * round prefix (e.g. "Clausura"). This function finds which prefix has
 * the most recent kickoff date and decides whether null-group matches
 * (rounds without a prefix, like standalone "Quarter-finals") are stale
 * leftovers or current knockout rounds.
 *
 * Null-group matches are considered stale when their latest date is before
 * the active group's earliest date — they belong to a previous
 * sub-tournament that was never cleaned up.
 */
export function getActiveGroupInfo(
  matches: Array<{ group: string | null; kickoffTime: Date | string }>,
): ActiveGroupResult {
  const groupDates = new Map<string, { min: Date; max: Date }>();
  let nullGroupMax: Date | null = null;

  for (const m of matches) {
    const d = new Date(m.kickoffTime);
    if (!m.group) {
      if (!nullGroupMax || d > nullGroupMax) nullGroupMax = d;
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
  if (groupDates.size === 0) return { activeGroup: null, includeNullGroup: true };

  // Find the group with the latest max date
  let latestGroup = "";
  let latestDate = new Date(0);
  for (const [group, dates] of groupDates) {
    if (dates.max > latestDate) {
      latestDate = dates.max;
      latestGroup = group;
    }
  }

  // No null-group matches → only filter if multiple non-null groups exist
  if (!nullGroupMax) {
    if (groupDates.size <= 1) return { activeGroup: null, includeNullGroup: true };
    return { activeGroup: latestGroup, includeNullGroup: true };
  }

  // Null-group matches exist. Are they stale?
  // They're stale if their latest date is before the active group's earliest date.
  const activeGroupDates = groupDates.get(latestGroup)!;
  const nullGroupIsStale = nullGroupMax < activeGroupDates.min;

  if (groupDates.size > 1 || nullGroupIsStale) {
    return { activeGroup: latestGroup, includeNullGroup: !nullGroupIsStale };
  }

  // Single non-null group with current null-group matches → no filtering needed
  return { activeGroup: null, includeNullGroup: true };
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

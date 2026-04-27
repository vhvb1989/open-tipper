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
 * Determine the active sub-tournament group prefix.
 *
 * Leagues like Liga MX run two tournaments per season (Apertura, Clausura)
 * within the same API-Football "season". The `group` column stores the
 * round prefix (e.g. "Clausura"). This function finds which prefix has
 * the most recent kickoff date and returns it.
 *
 * Returns `null` if there is only one (or zero) group — no filtering needed.
 */
export function getActiveGroup(
  matches: Array<{ group: string | null; kickoffTime: Date | string }>,
): string | null {
  const groupDates = new Map<string, Date>();
  for (const m of matches) {
    if (!m.group) continue;
    const d = new Date(m.kickoffTime);
    const existing = groupDates.get(m.group);
    if (!existing || d > existing) groupDates.set(m.group, d);
  }

  if (groupDates.size <= 1) return null;

  let latestGroup = "";
  let latestDate = new Date(0);
  for (const [group, date] of groupDates) {
    if (date > latestDate) {
      latestDate = date;
      latestGroup = group;
    }
  }

  return latestGroup;
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

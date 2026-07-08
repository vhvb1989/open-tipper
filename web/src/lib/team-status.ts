/**
 * Team tournament-status utilities.
 *
 * Derives which teams have been eliminated from a knockout tournament so the UI
 * can visually distinguish teams that are still alive (in the current or next
 * round) from teams that are out.
 *
 * Elimination rule:
 *   - A team is "alive" if it appears (home or away) in ANY not-yet-finished
 *     match of the contest (statuses: SCHEDULED, TIMED, IN_PLAY, PAUSED,
 *     SUSPENDED, POSTPONED).
 *   - A team with no upcoming match is considered "eliminated" only if it LOST
 *     its most recent finished knockout (playoff) tie on aggregate. Ties are
 *     aggregated across legs (same stage, same pair of teams) so two-legged
 *     knockouts are handled correctly. A team that won its last tie (e.g. the
 *     champion after the final) or that has no finished knockout match (e.g.
 *     still in group stage) is NOT marked eliminated.
 *   - Ties level on aggregate (typically decided by penalties) cannot be
 *     resolved from stored goals alone and are treated as "not lost". The
 *     away-goals rule is likewise not applied.
 */

import { isPlayoffStage } from "./scoring";

/** Minimal match shape required to derive team status. */
export interface TeamStatusMatch {
  stage: string | null;
  status: string;
  kickoffTime: Date | string;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number | null;
  awayGoals: number | null;
}

/** Match statuses that mean the match has NOT yet been played to completion. */
const NOT_FINISHED_STATUSES = new Set([
  "SCHEDULED",
  "TIMED",
  "IN_PLAY",
  "PAUSED",
  "SUSPENDED",
  "POSTPONED",
]);

/** Match statuses that mean the match is finished with a usable result. */
const FINISHED_STATUSES = new Set(["FINISHED", "AWARDED"]);

function toTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** Stable key for a knockout tie: same stage + unordered pair of teams. */
function tieKey(stage: string | null, a: string, b: string): string {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return `${stage ?? ""}::${lo}::${hi}`;
}

/** Aggregated result of a knockout tie between two teams (across legs). */
interface Tie {
  goals: Map<string, number>;
  latestKickoff: number;
}

/**
 * Compute the set of team ids that are eliminated from the tournament.
 *
 * @param matches All matches for the contest.
 * @returns Set of eliminated team ids.
 */
export function computeEliminatedTeamIds(matches: TeamStatusMatch[]): Set<string> {
  // Teams that still have an upcoming (not-yet-finished) match are alive.
  const aliveTeamIds = new Set<string>();
  for (const m of matches) {
    if (NOT_FINISHED_STATUSES.has(m.status)) {
      aliveTeamIds.add(m.homeTeamId);
      aliveTeamIds.add(m.awayTeamId);
    }
  }

  // Aggregate finished knockout matches into ties (same stage + team pair) so
  // two-legged knockouts are decided on aggregate rather than a single leg.
  const ties = new Map<string, Tie>();
  for (const m of matches) {
    if (!FINISHED_STATUSES.has(m.status)) continue;
    if (!isPlayoffStage(m.stage)) continue;
    if (m.homeGoals === null || m.awayGoals === null) continue;

    const key = tieKey(m.stage, m.homeTeamId, m.awayTeamId);
    let tie = ties.get(key);
    if (!tie) {
      tie = { goals: new Map(), latestKickoff: 0 };
      ties.set(key, tie);
    }
    tie.goals.set(m.homeTeamId, (tie.goals.get(m.homeTeamId) ?? 0) + m.homeGoals);
    tie.goals.set(m.awayTeamId, (tie.goals.get(m.awayTeamId) ?? 0) + m.awayGoals);
    tie.latestKickoff = Math.max(tie.latestKickoff, toTime(m.kickoffTime));
  }

  // For each team, keep only its most recent tie.
  const lastTie = new Map<string, Tie>();
  for (const tie of ties.values()) {
    for (const teamId of tie.goals.keys()) {
      const existing = lastTie.get(teamId);
      if (!existing || tie.latestKickoff > existing.latestKickoff) {
        lastTie.set(teamId, tie);
      }
    }
  }

  const eliminated = new Set<string>();
  for (const [teamId, tie] of lastTie) {
    if (aliveTeamIds.has(teamId)) continue; // still has an upcoming match

    let teamGoals = 0;
    let oppGoals = 0;
    for (const [id, goals] of tie.goals) {
      if (id === teamId) teamGoals = goals;
      else oppGoals = goals;
    }

    // Lost the tie on aggregate → eliminated. Level (penalties) or won → not.
    if (teamGoals < oppGoals) {
      eliminated.add(teamId);
    }
  }

  return eliminated;
}

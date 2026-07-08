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
 *     its most recent finished knockout (playoff) match. A team that won its
 *     last knockout match (e.g. the champion after the final) or that has no
 *     finished knockout match (e.g. eliminated/still in group stage without a
 *     decisive knockout loss) is NOT marked eliminated.
 *   - Matches with tied goals (typically decided by penalties) cannot be
 *     resolved from stored goals alone and are treated as "not lost".
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

  // For each team, find its most recent finished knockout match.
  const lastKnockout = new Map<string, TeamStatusMatch>();
  const consider = (teamId: string, match: TeamStatusMatch) => {
    const existing = lastKnockout.get(teamId);
    if (!existing || toTime(match.kickoffTime) > toTime(existing.kickoffTime)) {
      lastKnockout.set(teamId, match);
    }
  };

  for (const m of matches) {
    if (!FINISHED_STATUSES.has(m.status)) continue;
    if (!isPlayoffStage(m.stage)) continue;
    if (m.homeGoals === null || m.awayGoals === null) continue;
    consider(m.homeTeamId, m);
    consider(m.awayTeamId, m);
  }

  const eliminated = new Set<string>();
  for (const [teamId, match] of lastKnockout) {
    if (aliveTeamIds.has(teamId)) continue; // still has an upcoming match

    const isHome = match.homeTeamId === teamId;
    const teamGoals = isHome ? match.homeGoals! : match.awayGoals!;
    const oppGoals = isHome ? match.awayGoals! : match.homeGoals!;

    // Lost its last knockout match → eliminated. Tied (penalties) or won → not.
    if (teamGoals < oppGoals) {
      eliminated.add(teamId);
    }
  }

  return eliminated;
}

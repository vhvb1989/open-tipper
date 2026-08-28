/**
 * Scoring Service
 *
 * Database-integrated scoring logic. When a match finishes, this service:
 * 1. Finds all predictions for that match across all groups
 * 2. Loads each group's scoring rules
 * 3. Calculates points using the scoring engine
 * 4. Calculates uniqueness bonus when enabled
 * 5. Stores the pointsAwarded and bonusPoints on each prediction
 */

import { PrismaClient } from "@/generated/prisma/client";
import {
  calculateScore,
  isPlayoffStage,
  type ScoringRulesConfig,
  type ScoringBreakdown,
} from "./scoring";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreMatchResult {
  matchId: string;
  predictionsScored: number;
}

export interface BackfillResult {
  matchesProcessed: number;
  predictionsCreated: number;
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Score all predictions for a single finished match.
 *
 * Called after a sync detects that a match status has changed to FINISHED.
 * For each group that has predictions for this match, loads the group's
 * scoring rules and calculates points.
 *
 * @param matchId - The database ID of the finished match
 * @param db - Prisma client instance
 * @returns Number of predictions scored
 */
export async function scoreMatch(matchId: string, db: PrismaClient): Promise<ScoreMatchResult> {
  // 1. Load the match with its result
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      homeGoals: true,
      awayGoals: true,
      status: true,
      stage: true,
      kickoffTime: true,
    },
  });

  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  if (match.homeGoals === null || match.awayGoals === null) {
    throw new Error(`Match ${matchId} has no result yet`);
  }

  const result = { homeGoals: match.homeGoals, awayGoals: match.awayGoals };
  const isPlayoff = isPlayoffStage(match.stage);

  // 2. Find all predictions for this match, grouped with their group's scoring rules
  const predictions = await db.prediction.findMany({
    where: { matchId },
    include: {
      group: {
        include: {
          scoringRules: true,
        },
      },
    },
  });

  if (predictions.length === 0) {
    return { matchId, predictionsScored: 0 };
  }

  // 3. Group predictions by groupId for uniqueness bonus calculation
  const byGroup = new Map<string, typeof predictions>();
  for (const prediction of predictions) {
    const list = byGroup.get(prediction.groupId) ?? [];
    list.push(prediction);
    byGroup.set(prediction.groupId, list);
  }

  // 4. Calculate and update points for each group's predictions
  let scored = 0;
  for (const [, groupPredictions] of byGroup) {
    const rules = groupPredictions[0].group.scoringRules;
    const rulesConfig: ScoringRulesConfig = rules
      ? {
          exactScore: rules.exactScore,
          goalDifference: rules.goalDifference,
          outcome: rules.outcome,
          oneTeamGoals: rules.oneTeamGoals,
          totalGoals: rules.totalGoals,
          reverseGoalDifference: rules.reverseGoalDifference,
          accumulationMode: rules.accumulationMode,
          playoffMultiplier: rules.playoffMultiplier,
        }
      : {
          exactScore: 10,
          goalDifference: 6,
          outcome: 4,
          oneTeamGoals: 3,
          totalGoals: 2,
          reverseGoalDifference: 1,
          accumulationMode: "ACCUMULATE" as const,
          playoffMultiplier: false,
        };

    const bonusEnabled = rules?.uniqueBonusEnabled ?? false;
    const bonusMultiplier = rules?.uniqueBonusMultiplier ?? 2.0;
    const bonusEnabledAt = rules?.bonusEnabledAt ?? null;

    // Bonus only applies if the match kicked off after the feature was enabled
    const bonusApplies =
      bonusEnabled && bonusEnabledAt !== null && match.kickoffTime >= bonusEnabledAt;

    // Calculate breakdowns for all predictions in this group
    const breakdowns: Array<{
      predictionId: string;
      isBackfilled: boolean;
      breakdown: ScoringBreakdown;
    }> = [];

    for (const prediction of groupPredictions) {
      const scoring = calculateScore(
        { homeGoals: prediction.homeGoals, awayGoals: prediction.awayGoals },
        result,
        rulesConfig,
        isPlayoff,
      );
      breakdowns.push({
        predictionId: prediction.id,
        isBackfilled: prediction.isBackfilled,
        breakdown: scoring,
      });
    }

    // Count how many non-backfilled predictions earned each factor
    const factorKeys = [
      "exactScore",
      "goalDifference",
      "outcome",
      "oneTeamGoals",
      "totalGoals",
      "reverseGoalDifference",
    ] as const;

    const factorCounts: Record<string, number> = {};
    for (const key of factorKeys) {
      factorCounts[key] = breakdowns.filter((b) => !b.isBackfilled && b.breakdown[key] > 0).length;
    }

    // Update each prediction with points and bonus
    for (const { predictionId, isBackfilled, breakdown } of breakdowns) {
      let bonusPoints = 0;

      // Only award bonus to non-backfilled predictions when feature is enabled
      // and the match kicked off after the feature was turned on
      if (bonusApplies && !isBackfilled) {
        for (const key of factorKeys) {
          if (breakdown[key] > 0 && factorCounts[key] === 1) {
            // This player is the only one who earned this factor
            bonusPoints += Math.round(breakdown[key] * (bonusMultiplier - 1));
          }
        }
      }

      await db.prediction.update({
        where: { id: predictionId },
        data: { pointsAwarded: breakdown.total, bonusPoints },
      });

      scored++;
    }
  }

  // Record the result used for this scoring pass. If the data provider later
  // corrects the final score, scoreFinishedMatches will detect the mismatch
  // and recalculate every prediction for the match.
  await db.match.update({
    where: { id: matchId },
    data: {
      scoredHomeGoals: match.homeGoals,
      scoredAwayGoals: match.awayGoals,
    },
  });

  return { matchId, predictionsScored: scored };
}

/**
 * Score predictions for newly finished matches and corrected final results.
 *
 * A match is scored when it has an unscored prediction or when its current
 * final score differs from the result used by the previous scoring pass.
 *
 * @param contestId - The contest to check for finished matches
 * @param db - Prisma client instance
 * @returns Array of scoring results
 */
export async function scoreFinishedMatches(
  contestId: string,
  db: PrismaClient,
): Promise<ScoreMatchResult[]> {
  const finishedMatches = await db.match.findMany({
    where: {
      contestId,
      status: { in: ["FINISHED", "AWARDED"] },
      homeGoals: { not: null },
      awayGoals: { not: null },
      predictions: { some: {} },
    },
    select: {
      id: true,
      homeGoals: true,
      awayGoals: true,
      scoredHomeGoals: true,
      scoredAwayGoals: true,
      predictions: {
        where: { pointsAwarded: null },
        select: { id: true },
        take: 1,
      },
    },
  });

  const matchesToScore = finishedMatches.filter(
    (match) =>
      match.predictions.length > 0 ||
      match.scoredHomeGoals !== match.homeGoals ||
      match.scoredAwayGoals !== match.awayGoals,
  );

  const results: ScoreMatchResult[] = [];
  for (const match of matchesToScore) {
    try {
      const result = await scoreMatch(match.id, db);
      results.push(result);
    } catch (error) {
      console.error(`Failed to score match ${match.id}:`, error);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Default prediction backfill
// ---------------------------------------------------------------------------

/**
 * Auto-create 0-0 predictions for group members who forgot to submit
 * a prediction before kick-off.
 *
 * Runs as part of the sync pipeline, before scoring. For each match in
 * the contest that has already kicked off (status is no longer SCHEDULED/TIMED),
 * finds group members who have no prediction and creates a 0-0 default.
 *
 * This ensures:
 * - Every member appears in every match's results
 * - Forgotten matches still earn points if 0-0 happens to be correct
 * - Standings are fair — no one can dodge bad predictions by skipping
 *
 * @param contestId - The contest to backfill predictions for
 * @param db - Prisma client instance
 */
export async function backfillDefaultPredictions(
  contestId: string,
  db: PrismaClient,
): Promise<BackfillResult> {
  // Find all matches that have kicked off (not SCHEDULED/TIMED)
  const kickedOffMatches = await db.match.findMany({
    where: {
      contestId,
      status: { notIn: ["SCHEDULED", "TIMED"] },
    },
    select: { id: true },
  });

  if (kickedOffMatches.length === 0) {
    return { matchesProcessed: 0, predictionsCreated: 0 };
  }

  // Find all groups for this contest with their members
  const groups = await db.group.findMany({
    where: { contestId },
    select: {
      id: true,
      memberships: {
        select: { userId: true },
      },
    },
  });

  if (groups.length === 0) {
    return { matchesProcessed: 0, predictionsCreated: 0 };
  }

  let totalCreated = 0;
  const matchIds = kickedOffMatches.map((m) => m.id);

  for (const group of groups) {
    const memberUserIds = group.memberships.map((m) => m.userId);
    if (memberUserIds.length === 0) continue;

    // Get all existing predictions for this group's kicked-off matches
    const existingPredictions = await db.prediction.findMany({
      where: {
        groupId: group.id,
        matchId: { in: matchIds },
      },
      select: { userId: true, matchId: true },
    });

    // Build a set of "userId:matchId" for quick lookup
    const existingKeys = new Set(existingPredictions.map((p) => `${p.userId}:${p.matchId}`));

    // Find missing predictions and batch-create them
    const missing: {
      userId: string;
      groupId: string;
      matchId: string;
      homeGoals: number;
      awayGoals: number;
      isBackfilled: boolean;
    }[] = [];

    for (const matchId of matchIds) {
      for (const userId of memberUserIds) {
        if (!existingKeys.has(`${userId}:${matchId}`)) {
          missing.push({
            userId,
            groupId: group.id,
            matchId,
            homeGoals: 0,
            awayGoals: 0,
            isBackfilled: true,
          });
        }
      }
    }

    if (missing.length > 0) {
      const result = await db.prediction.createMany({
        data: missing,
        skipDuplicates: true,
      });
      totalCreated += result.count;
    }
  }

  return {
    matchesProcessed: kickedOffMatches.length,
    predictionsCreated: totalCreated,
  };
}

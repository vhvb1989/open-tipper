/**
 * Scoring Service
 *
 * Database-integrated scoring logic. When a match finishes, this service:
 * 1. Finds all predictions for that match across all groups
 * 2. Loads each group's scoring rules
 * 3. Calculates points using the scoring engine
 * 4. Stores the pointsAwarded on each prediction
 */

import { PrismaClient } from "@/generated/prisma/client";
import { calculateScore, isPlayoffStage, type ScoringRulesConfig } from "./scoring";

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

  // 3. Calculate and update points for each prediction
  let scored = 0;
  for (const prediction of predictions) {
    const rules = prediction.group.scoringRules;
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
          // Fallback to defaults if no scoring rules configured
          exactScore: 10,
          goalDifference: 6,
          outcome: 4,
          oneTeamGoals: 3,
          totalGoals: 2,
          reverseGoalDifference: 1,
          accumulationMode: "ACCUMULATE" as const,
          playoffMultiplier: false,
        };

    const scoring = calculateScore(
      { homeGoals: prediction.homeGoals, awayGoals: prediction.awayGoals },
      result,
      rulesConfig,
      isPlayoff,
    );

    await db.prediction.update({
      where: { id: prediction.id },
      data: { pointsAwarded: scoring.total },
    });

    scored++;
  }

  return { matchId, predictionsScored: scored };
}

/**
 * Score all predictions for all newly finished matches in a contest.
 *
 * Finds matches that are FINISHED but have unscored predictions
 * (pointsAwarded IS NULL), and scores each one.
 *
 * @param contestId - The contest to check for finished matches
 * @param db - Prisma client instance
 * @returns Array of scoring results
 */
export async function scoreFinishedMatches(
  contestId: string,
  db: PrismaClient,
): Promise<ScoreMatchResult[]> {
  // Find finished matches in this contest that have at least one unscored prediction
  const matchesWithUnscoredPredictions = await db.match.findMany({
    where: {
      contestId,
      status: { in: ["FINISHED", "AWARDED"] },
      homeGoals: { not: null },
      awayGoals: { not: null },
      predictions: {
        some: {
          pointsAwarded: null,
        },
      },
    },
    select: { id: true },
  });

  const results: ScoreMatchResult[] = [];
  for (const match of matchesWithUnscoredPredictions) {
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

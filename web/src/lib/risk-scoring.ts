/**
 * Risk Scoring Service
 *
 * Resolves risk predictions after a match finishes by comparing
 * user-predicted values against actual match statistics.
 *
 * Payouts are tier-based per category (see risk-tiers.ts):
 * - Bullseye (exact) is always the best reward.
 * - Closer guesses may win a smaller multiplier or a refund.
 */

import { PrismaClient, RiskStatus } from "@/generated/prisma/client";
import { scoreRisk } from "@/lib/risk-tiers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolveRisksResult {
  matchId: string;
  resolved: number;
  won: number;
  lost: number;
}

// ---------------------------------------------------------------------------
// Category → MatchStats field mapping
// ---------------------------------------------------------------------------

const CATEGORY_TO_STAT_FIELD = {
  YELLOW_CARDS: "yellowCards",
  CORNER_KICKS: "cornerKicks",
  OFFSIDES: "offsides",
} as const;

// ---------------------------------------------------------------------------
// Main resolution function
// ---------------------------------------------------------------------------

/**
 * Resolve all pending risk predictions for a finished match.
 *
 * Requires that MatchStats have already been fetched and stored for the match.
 * Compares each pending risk prediction against the actual stat value.
 *
 * @param matchId - The database ID of the finished match
 * @param db - Prisma client instance
 */
export async function resolveRisksForMatch(
  matchId: string,
  db: PrismaClient,
): Promise<ResolveRisksResult> {
  // 1. Load match stats
  const matchStats = await db.matchStats.findUnique({
    where: { matchId },
  });

  if (!matchStats) {
    return { matchId, resolved: 0, won: 0, lost: 0 };
  }

  // 2. Load all pending risk predictions for this match
  const pendingRisks = await db.riskPrediction.findMany({
    where: {
      matchId,
      status: RiskStatus.PENDING,
    },
  });

  if (pendingRisks.length === 0) {
    return { matchId, resolved: 0, won: 0, lost: 0 };
  }

  // 3. Resolve each prediction
  const now = new Date();
  let won = 0;
  let lost = 0;

  for (const risk of pendingRisks) {
    const statField = CATEGORY_TO_STAT_FIELD[risk.category];
    // Treat null/undefined as 0 (stat not reported means 0 occurrences)
    const actualValue = matchStats[statField] ?? 0;

    const { status, pointsAwarded } = scoreRisk(
      risk.category,
      risk.predictedValue,
      actualValue,
      risk.pointsRisked,
    );

    await db.riskPrediction.update({
      where: { id: risk.id },
      data: {
        status,
        pointsAwarded,
        resolvedAt: now,
      },
    });

    if (status === RiskStatus.WON) {
      won++;
    } else {
      lost++;
    }
  }

  return { matchId, resolved: won + lost, won, lost };
}

/**
 * Resolve risks for all finished matches in a contest that have
 * unresolved pending risk predictions and available match stats.
 */
export async function resolveRisksForContest(
  contestId: string,
  db: PrismaClient,
): Promise<ResolveRisksResult[]> {
  // Find matches that are finished, have stats, review window has closed,
  // and have pending risks
  const matchesWithPendingRisks = await db.match.findMany({
    where: {
      contestId,
      status: { in: ["FINISHED", "AWARDED"] },
      risksCompleted: true,
      stats: { isNot: null },
      riskPredictions: {
        some: { status: RiskStatus.PENDING },
      },
    },
    select: { id: true },
  });

  const results: ResolveRisksResult[] = [];
  for (const match of matchesWithPendingRisks) {
    const result = await resolveRisksForMatch(match.id, db);
    if (result.resolved > 0) {
      results.push(result);
    }
  }

  return results;
}

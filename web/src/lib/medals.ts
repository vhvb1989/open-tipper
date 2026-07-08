/**
 * Medal Service
 *
 * Awards a medal to the top scorer(s) of each round within a group. A round
 * is either a numeric match day (group stage) or a named playoff stage
 * ("Round of 16", "Quarter-finals", …). Medals are cosmetic — they don't
 * change points. When all matches in a round are finished and scored, the
 * member(s) with the highest aggregate points for that round receive a medal.
 *
 * Ties are allowed: every user sharing the top score gets a medal.
 */

import { PrismaClient, RiskStatus } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AwardMedalsResult {
  /** Stable round discriminator: "md:<n>" or "stage:<stage>". */
  round: string;
  /** Numeric match day for match-day rounds; null for playoff rounds. */
  matchDay: number | null;
  /** Full stage string for playoff rounds; null for match-day rounds. */
  stage: string | null;
  groupId: string;
  winnersCount: number;
}

interface RoundDescriptor {
  round: string;
  matchDay: number | null;
  stage: string | null;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Award medals for a specific round (match day or playoff stage) in a group.
 *
 * Pre-condition: all matches for this round must be FINISHED/AWARDED and all
 * predictions scored (pointsAwarded != null).
 *
 * Idempotent — uses upsert keyed on the round discriminator so re-running is
 * safe.
 */
async function awardRoundMedals(
  contestId: string,
  groupId: string,
  descriptor: RoundDescriptor,
  db: PrismaClient,
): Promise<AwardMedalsResult> {
  const { round, matchDay, stage } = descriptor;
  const empty: AwardMedalsResult = { round, matchDay, stage, groupId, winnersCount: 0 };

  // 1. Check that ALL matches for this round are finished.
  //    Match-day rounds are identified by matchDay; playoff rounds by their
  //    stage string (which always have a null matchDay).
  const matchWhere =
    matchDay != null ? { contestId, matchDay } : { contestId, stage, matchDay: null };
  const roundMatches = await db.match.findMany({
    where: matchWhere,
    select: { id: true, status: true },
  });

  if (roundMatches.length === 0) {
    return empty;
  }

  const allFinished = roundMatches.every((m) => m.status === "FINISHED" || m.status === "AWARDED");

  if (!allFinished) {
    // Not all matches are done yet — skip medal assignment
    return empty;
  }

  const matchIds = roundMatches.map((m) => m.id);

  // Risk points only count toward the score when the group has the risk
  // feature enabled (mirrors the standings calculation).
  const group = await db.group.findUnique({
    where: { id: groupId },
    select: { riskEnabled: true },
  });
  const riskEnabled = group?.riskEnabled === true;

  // 2. Check all predictions for these matches are scored
  const unscoredCount = await db.prediction.count({
    where: {
      groupId,
      matchId: { in: matchIds },
      pointsAwarded: null,
    },
  });

  if (unscoredCount > 0) {
    // Still have unscored predictions — skip
    return empty;
  }

  // 3. Aggregate points per user for this round.
  //    Round score must mirror the standings total: base points
  //    (pointsAwarded) + uniqueness bonus (bonusPoints) + net risk points.
  const predictions = await db.prediction.findMany({
    where: {
      groupId,
      matchId: { in: matchIds },
      pointsAwarded: { not: null },
    },
    select: {
      userId: true,
      pointsAwarded: true,
      bonusPoints: true,
    },
  });

  // Resolved risk predictions for this round (won/lost only — pending wagers
  // don't affect the score yet). Skipped entirely when the group has the risk
  // feature disabled.
  const riskPredictions = riskEnabled
    ? await db.riskPrediction.findMany({
        where: {
          groupId,
          matchId: { in: matchIds },
          status: { in: [RiskStatus.WON, RiskStatus.LOST] },
        },
        select: {
          userId: true,
          status: true,
          pointsRisked: true,
          pointsAwarded: true,
        },
      })
    : [];

  if (predictions.length === 0 && riskPredictions.length === 0) {
    return empty;
  }

  const pointsByUser = new Map<string, number>();
  for (const p of predictions) {
    const current = pointsByUser.get(p.userId) ?? 0;
    pointsByUser.set(p.userId, current + (p.pointsAwarded ?? 0) + (p.bonusPoints ?? 0));
  }

  for (const r of riskPredictions) {
    // Double-or-nothing: WON net = pointsAwarded - pointsRisked, LOST net = -pointsRisked
    const riskDelta =
      r.status === RiskStatus.WON ? (r.pointsAwarded ?? 0) - r.pointsRisked : -r.pointsRisked;
    const current = pointsByUser.get(r.userId) ?? 0;
    pointsByUser.set(r.userId, current + riskDelta);
  }

  if (pointsByUser.size === 0) {
    return empty;
  }

  // 4. Find the max score
  const maxPoints = Math.max(...pointsByUser.values());

  if (maxPoints <= 0) {
    // Nobody scored any points — no medal
    return empty;
  }

  // 5. All users with the max score get a medal
  const winners = [...pointsByUser.entries()]
    .filter(([, pts]) => pts === maxPoints)
    .map(([userId]) => userId);

  // 6. Remove any existing medals for this round + group that are no longer
  //    winners (handles re-scoring edge case)
  await db.medal.deleteMany({
    where: {
      groupId,
      round,
      userId: { notIn: winners },
    },
  });

  // 7. Upsert medals for winners
  for (const userId of winners) {
    await db.medal.upsert({
      where: {
        groupId_userId_round: { groupId, userId, round },
      },
      create: {
        groupId,
        userId,
        round,
        matchDay,
        stage,
        points: maxPoints,
      },
      update: {
        points: maxPoints,
        matchDay,
        stage,
      },
    });
  }

  return { round, matchDay, stage, groupId, winnersCount: winners.length };
}

/**
 * Award medals for a specific match day in a specific group.
 *
 * Idempotent — safe to re-run.
 */
export async function awardMatchDayMedals(
  contestId: string,
  groupId: string,
  matchDay: number,
  db: PrismaClient,
): Promise<AwardMedalsResult> {
  return awardRoundMedals(
    contestId,
    groupId,
    { round: `md:${matchDay}`, matchDay, stage: null },
    db,
  );
}

/**
 * Award medals for a specific playoff stage in a specific group.
 *
 * Idempotent — safe to re-run.
 */
export async function awardStageMedals(
  contestId: string,
  groupId: string,
  stage: string,
  db: PrismaClient,
): Promise<AwardMedalsResult> {
  return awardRoundMedals(
    contestId,
    groupId,
    { round: `stage:${stage}`, matchDay: null, stage },
    db,
  );
}

/**
 * Award medals for ALL completed rounds in a contest, for all groups.
 *
 * Covers both numeric match days and playoff stages. Called after scoring to
 * ensure medals are up-to-date.
 */
export async function awardMedalsForContest(
  contestId: string,
  db: PrismaClient,
): Promise<AwardMedalsResult[]> {
  // Find all groups for this contest
  const groups = await db.group.findMany({
    where: { contestId },
    select: { id: true },
  });

  // Find all distinct match days that have finished matches
  const finishedMatchDays = await db.match.findMany({
    where: {
      contestId,
      status: { in: ["FINISHED", "AWARDED"] },
      matchDay: { not: null },
    },
    select: { matchDay: true },
    distinct: ["matchDay"],
  });

  const matchDays = finishedMatchDays.map((m) => m.matchDay!).sort((a, b) => a - b);

  // Find all distinct playoff stages that have finished matches (matchDay null)
  const finishedStages = await db.match.findMany({
    where: {
      contestId,
      status: { in: ["FINISHED", "AWARDED"] },
      matchDay: null,
      stage: { not: null },
    },
    select: { stage: true },
    distinct: ["stage"],
  });

  const stages = finishedStages.map((m) => m.stage!);

  const results: AwardMedalsResult[] = [];

  for (const group of groups) {
    for (const matchDay of matchDays) {
      try {
        const result = await awardMatchDayMedals(contestId, group.id, matchDay, db);
        if (result.winnersCount > 0) {
          results.push(result);
        }
      } catch (error) {
        console.error(
          `Failed to award medals for group ${group.id}, match day ${matchDay}:`,
          error,
        );
      }
    }

    for (const stage of stages) {
      try {
        const result = await awardStageMedals(contestId, group.id, stage, db);
        if (result.winnersCount > 0) {
          results.push(result);
        }
      } catch (error) {
        console.error(`Failed to award medals for group ${group.id}, stage ${stage}:`, error);
      }
    }
  }

  return results;
}

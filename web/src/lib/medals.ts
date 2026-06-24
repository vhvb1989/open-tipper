/**
 * Medal Service
 *
 * Awards a medal to the top scorer(s) of each match day within a group.
 * Medals are cosmetic — they don't change points. When all matches in a
 * match day are finished and scored, the member(s) with the highest
 * aggregate points for that match day receive a medal.
 *
 * Ties are allowed: every user sharing the top score gets a medal.
 */

import { PrismaClient, RiskStatus } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AwardMedalsResult {
  matchDay: number;
  groupId: string;
  winnersCount: number;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Award medals for a specific match day in a specific group.
 *
 * Pre-condition: all matches for this match day must be FINISHED and all
 * predictions scored (pointsAwarded != null).
 *
 * Idempotent — uses upsert so re-running is safe.
 */
export async function awardMatchDayMedals(
  contestId: string,
  groupId: string,
  matchDay: number,
  db: PrismaClient,
): Promise<AwardMedalsResult> {
  // 1. Check that ALL matches for this match day are finished
  const matchDayMatches = await db.match.findMany({
    where: { contestId, matchDay },
    select: { id: true, status: true },
  });

  if (matchDayMatches.length === 0) {
    return { matchDay, groupId, winnersCount: 0 };
  }

  const allFinished = matchDayMatches.every(
    (m) => m.status === "FINISHED" || m.status === "AWARDED",
  );

  if (!allFinished) {
    // Not all matches are done yet — skip medal assignment
    return { matchDay, groupId, winnersCount: 0 };
  }

  const matchIds = matchDayMatches.map((m) => m.id);

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
    return { matchDay, groupId, winnersCount: 0 };
  }

  // 3. Aggregate points per user for this match day.
  //    Match-day score must mirror the standings total: base points
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

  // Resolved risk predictions for this match day (won/lost only — pending
  // wagers don't affect the score yet). Skipped entirely when the group has
  // the risk feature disabled.
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
    return { matchDay, groupId, winnersCount: 0 };
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
    return { matchDay, groupId, winnersCount: 0 };
  }

  // 4. Find the max score
  const maxPoints = Math.max(...pointsByUser.values());

  if (maxPoints <= 0) {
    // Nobody scored any points — no medal
    return { matchDay, groupId, winnersCount: 0 };
  }

  // 5. All users with the max score get a medal
  const winners = [...pointsByUser.entries()]
    .filter(([, pts]) => pts === maxPoints)
    .map(([userId]) => userId);

  // 6. Remove any existing medals for this match day + group that are no longer winners
  //    (handles re-scoring edge case)
  await db.medal.deleteMany({
    where: {
      groupId,
      matchDay,
      userId: { notIn: winners },
    },
  });

  // 7. Upsert medals for winners
  for (const userId of winners) {
    await db.medal.upsert({
      where: {
        groupId_userId_matchDay: { groupId, userId, matchDay },
      },
      create: {
        groupId,
        userId,
        matchDay,
        points: maxPoints,
      },
      update: {
        points: maxPoints,
      },
    });
  }

  return { matchDay, groupId, winnersCount: winners.length };
}

/**
 * Award medals for ALL completed match days in a contest, for all groups.
 *
 * Called after scoring to ensure medals are up-to-date.
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
  }

  return results;
}

/**
 * Podium Scoring Service
 *
 * Determines tournament podium finishers (1st, 2nd, 3rd place) from match
 * results and scores users' podium predictions accordingly. Awards podium
 * badges for correct predictions.
 *
 * Triggered after match scoring in the sync pipeline, but only actually
 * scores when ALL matches in the contest are finished.
 */

import { PrismaClient, PodiumPosition } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TournamentPodium {
  first: string | null;
  second: string | null;
  third: string | null;
}

export interface PodiumScoringResult {
  contestId: string;
  groupsScored: number;
  predictionsScored: number;
  badgesAwarded: number;
}

// ---------------------------------------------------------------------------
// Determine tournament podium from match results
// ---------------------------------------------------------------------------

/**
 * Determine the 1st, 2nd, and 3rd place teams from the tournament's knockout
 * matches. Uses the FINAL match to determine 1st/2nd and looks for a 3rd
 * place match (stage containing "3rd" or "Third") for 3rd.
 */
export async function determineTournamentPodium(
  contestId: string,
  db: PrismaClient,
): Promise<TournamentPodium> {
  // Find the final match
  const finalMatch = await db.match.findFirst({
    where: {
      contestId,
      stage: { contains: "Final", mode: "insensitive" },
      NOT: [
        { stage: { contains: "Semi", mode: "insensitive" } },
        { stage: { contains: "Quarter", mode: "insensitive" } },
      ],
      status: { in: ["FINISHED", "AWARDED"] },
    },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      homeGoals: true,
      awayGoals: true,
    },
    orderBy: { kickoffTime: "desc" },
  });

  let first: string | null = null;
  let second: string | null = null;

  if (finalMatch && finalMatch.homeGoals !== null && finalMatch.awayGoals !== null) {
    if (finalMatch.homeGoals > finalMatch.awayGoals) {
      first = finalMatch.homeTeamId;
      second = finalMatch.awayTeamId;
    } else if (finalMatch.awayGoals > finalMatch.homeGoals) {
      first = finalMatch.awayTeamId;
      second = finalMatch.homeTeamId;
    }
    // When goals are tied (match decided by penalties), we cannot reliably
    // determine the winner from stored regular/ET goals alone. first/second
    // remain null and podium scoring will be skipped until penalty data is
    // available in a future enhancement.
  }

  // Find 3rd place match (World Cup style)
  const thirdPlaceMatch = await db.match.findFirst({
    where: {
      contestId,
      OR: [
        { stage: { contains: "3rd", mode: "insensitive" } },
        { stage: { contains: "Third", mode: "insensitive" } },
      ],
      status: { in: ["FINISHED", "AWARDED"] },
    },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      homeGoals: true,
      awayGoals: true,
    },
  });

  let third: string | null = null;
  if (thirdPlaceMatch && thirdPlaceMatch.homeGoals !== null && thirdPlaceMatch.awayGoals !== null) {
    if (thirdPlaceMatch.homeGoals > thirdPlaceMatch.awayGoals) {
      third = thirdPlaceMatch.homeTeamId;
    } else if (thirdPlaceMatch.awayGoals > thirdPlaceMatch.homeGoals) {
      third = thirdPlaceMatch.awayTeamId;
    }
    // Tied 3rd place match (penalties) — same limitation as final
  }

  return { first, second, third };
}

// ---------------------------------------------------------------------------
// Score podium predictions
// ---------------------------------------------------------------------------

/**
 * Score podium predictions for all groups linked to a contest.
 *
 * Only scores when ALL matches in the contest are FINISHED/AWARDED.
 * Idempotent — skips predictions that have already been scored.
 */
export async function scorePodiumPredictions(
  contestId: string,
  db: PrismaClient,
): Promise<PodiumScoringResult> {
  const result: PodiumScoringResult = {
    contestId,
    groupsScored: 0,
    predictionsScored: 0,
    badgesAwarded: 0,
  };

  // Check if ALL matches in the contest are finished
  const unfinishedCount = await db.match.count({
    where: {
      contestId,
      status: { notIn: ["FINISHED", "AWARDED", "CANCELLED", "POSTPONED"] },
    },
  });

  if (unfinishedCount > 0) {
    return result; // Not ready — some matches still pending
  }

  // Determine actual podium
  const podium = await determineTournamentPodium(contestId, db);
  if (!podium.first || !podium.second) {
    return result; // Can't determine winners yet
  }

  // Find all groups with podium enabled for this contest
  const groups = await db.group.findMany({
    where: {
      contestId,
      podiumSettings: {
        enabled: true,
      },
    },
    include: {
      podiumSettings: true,
    },
  });

  for (const group of groups) {
    const settings = group.podiumSettings;
    if (!settings) continue;

    // Wrap per-group scoring in a transaction to prevent race conditions
    await db.$transaction(async (tx) => {
      // Find unscored predictions for this group
      const predictions = await tx.podiumPrediction.findMany({
        where: {
          groupId: group.id,
          scoredAt: null,
        },
      });

      if (predictions.length === 0) return;

      result.groupsScored++;

      for (const pred of predictions) {
        let firstPts = 0;
        let secondPts = 0;
        let thirdPts = 0;

        // Check 1st place
        if (pred.firstPlaceTeamId === podium.first) {
          firstPts = settings.firstPlacePoints;
        }

        // Check 2nd place
        if (pred.secondPlaceTeamId === podium.second) {
          secondPts = settings.secondPlacePoints;
        }

        // Check 3rd place (only if enabled and there is a 3rd place result)
        if (settings.thirdPlaceEnabled && podium.third && pred.thirdPlaceTeamId === podium.third) {
          thirdPts = settings.thirdPlacePoints;
        }

        // Update prediction with scores
        await tx.podiumPrediction.update({
          where: { id: pred.id },
          data: {
            firstPlacePoints: firstPts,
            secondPlacePoints: secondPts,
            thirdPlacePoints: thirdPts,
            scoredAt: new Date(),
          },
        });
        result.predictionsScored++;

        // Award badges for correct predictions
        const badgeEntries: { position: PodiumPosition; points: number }[] = [];
        if (firstPts > 0) badgeEntries.push({ position: "FIRST", points: firstPts });
        if (secondPts > 0) badgeEntries.push({ position: "SECOND", points: secondPts });
        if (thirdPts > 0) badgeEntries.push({ position: "THIRD", points: thirdPts });

        for (const badge of badgeEntries) {
          await tx.podiumBadge.upsert({
            where: {
              groupId_userId_position: {
                groupId: group.id,
                userId: pred.userId,
                position: badge.position,
              },
            },
            create: {
              groupId: group.id,
              userId: pred.userId,
              position: badge.position,
              points: badge.points,
            },
            update: {
              points: badge.points,
            },
          });
          result.badgesAwarded++;
        }
      }
    });
  }

  return result;
}

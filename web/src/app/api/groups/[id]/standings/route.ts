import { NextRequest, NextResponse } from "next/server";
import { RiskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { buildRounds, getRoundLabel } from "@/lib/rounds";
import { computeEliminatedTeamIds } from "@/lib/team-status";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/groups/:id/standings
 *
 * Returns a ranked leaderboard for the group. Aggregates pointsAwarded
 * from all scored predictions per member. Includes total points, number of
 * predictions scored, and per-round breakdown for "last round" display.
 *
 * Supports both numeric match days and playoff stages via the unified
 * Round system. Accepts `matchDay` or `stage` query params for filtering.
 *
 * Public groups: visible to anyone (auth optional).
 * Private groups: visible to members only.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const { id: groupId } = await params;
    const { searchParams } = new URL(request.url);
    const matchDayParam = searchParams.get("matchDay");
    const stageParam = searchParams.get("stage");

    // Get the group with contest info and visibility
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { contestId: true, visibility: true, riskEnabled: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    const riskEnabled = group.riskEnabled === true;

    // Access control: public groups are visible to anyone, private groups to members only
    if (group.visibility === "PRIVATE") {
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const membership = await prisma.membership.findUnique({
        where: { userId_groupId: { userId, groupId } },
      });
      if (!membership) {
        return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
      }
    }

    // Get all members
    const members = await prisma.membership.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    // Get all scored predictions (with match info for round breakdown)
    const predictions = await prisma.prediction.findMany({
      where: {
        groupId,
        pointsAwarded: { not: null },
      },
      select: {
        userId: true,
        pointsAwarded: true,
        bonusPoints: true,
        match: {
          select: { matchDay: true, stage: true, kickoffTime: true },
        },
      },
    });

    const resolvedRiskPredictions = riskEnabled
      ? await prisma.riskPrediction.findMany({
          where: {
            groupId,
            status: {
              in: [RiskStatus.WON, RiskStatus.LOST],
            },
          },
          select: {
            userId: true,
            status: true,
            pointsRisked: true,
            pointsAwarded: true,
            match: {
              select: { matchDay: true, stage: true },
            },
          },
        })
      : [];

    // Build unified rounds list from scored matches
    const scoredMatchData = predictions.map((p) => ({
      matchDay: p.match.matchDay,
      stage: p.match.stage,
      kickoffTime: p.match.kickoffTime,
    }));
    const rounds = buildRounds(scoredMatchData);

    // Legacy: numeric matchDays for backward compat
    const sortedMatchDays = rounds
      .filter((r) => r.type === "matchDay")
      .map((r) => r.matchDay!)
      .sort((a, b) => a - b);
    const latestMatchDay = sortedMatchDays[sortedMatchDays.length - 1] ?? null;

    // Determine which round is selected
    let selectedMatchDay: number | null = null;
    let selectedStage: string | null = null;

    if (matchDayParam) {
      selectedMatchDay = parseInt(matchDayParam, 10);
    } else if (stageParam) {
      selectedStage = stageParam;
    } else if (rounds.length > 0) {
      // Default to the latest round (last by kickoff order)
      const latestRound = rounds[rounds.length - 1];
      if (latestRound.type === "matchDay") {
        selectedMatchDay = latestRound.matchDay;
      } else {
        selectedStage = latestRound.stage;
      }
    }

    // Aggregate points per user
    const totals = new Map<
      string,
      { total: number; scored: number; lastRound: number; bonus: number }
    >();

    // Initialize all members with 0
    for (const m of members) {
      totals.set(m.user.id, { total: 0, scored: 0, lastRound: 0, bonus: 0 });
    }

    for (const p of predictions) {
      const entry = totals.get(p.userId);
      if (!entry) continue;
      const pts = p.pointsAwarded ?? 0;
      const bonus = p.bonusPoints ?? 0;
      entry.total += pts + bonus;
      entry.bonus += bonus;
      entry.scored += 1;
      // Match against selected round (matchDay or stage)
      if (selectedMatchDay != null && p.match.matchDay === selectedMatchDay) {
        entry.lastRound += pts + bonus;
      } else if (selectedStage != null && p.match.stage === selectedStage) {
        entry.lastRound += pts + bonus;
      }
    }

    const riskPointsByUser = new Map<string, number>();
    for (const riskPrediction of resolvedRiskPredictions) {
      const currentRiskPoints = riskPointsByUser.get(riskPrediction.userId) ?? 0;
      // Double-or-nothing: WON net = pointsAwarded - pointsRisked, LOST net = -pointsRisked
      const riskDelta =
        riskPrediction.status === RiskStatus.WON
          ? (riskPrediction.pointsAwarded ?? 0) - riskPrediction.pointsRisked
          : -riskPrediction.pointsRisked;

      riskPointsByUser.set(riskPrediction.userId, currentRiskPoints + riskDelta);

      // Include risk winnings/losses in the selected round total so that
      // "last round" reflects the same points that drive the standings
      // (base + uniqueness bonus + net risk), matching the medal calculation.
      const inSelectedRound =
        (selectedMatchDay != null && riskPrediction.match.matchDay === selectedMatchDay) ||
        (selectedStage != null && riskPrediction.match.stage === selectedStage);
      if (inSelectedRound) {
        const entry = totals.get(riskPrediction.userId);
        if (entry) entry.lastRound += riskDelta;
      }
    }

    // Fetch medals for this group (match-day and playoff-round medals)
    const medals = await prisma.medal.findMany({
      where: { groupId },
      select: { userId: true, round: true, matchDay: true, stage: true, points: true },
      orderBy: { createdAt: "asc" },
    });

    // Group medals by userId. Each medal carries a display label: the match-day
    // number for group-stage rounds, or the stage name for playoff rounds.
    const medalsByUser = new Map<
      string,
      {
        round: string;
        matchDay: number | null;
        stage: string | null;
        label: string;
        points: number;
      }[]
    >();
    for (const medal of medals) {
      const list = medalsByUser.get(medal.userId) ?? [];
      const label =
        medal.matchDay != null ? String(medal.matchDay) : getRoundLabel(medal.stage ?? "");
      list.push({
        round: medal.round,
        matchDay: medal.matchDay,
        stage: medal.stage,
        label,
        points: medal.points,
      });
      medalsByUser.set(medal.userId, list);
    }

    // Fetch podium badges for this group
    const podiumBadges = await prisma.podiumBadge.findMany({
      where: { groupId },
      select: { userId: true, position: true, points: true },
    });

    const podiumBadgesByUser = new Map<string, { position: string; points: number }[]>();
    for (const badge of podiumBadges) {
      const list = podiumBadgesByUser.get(badge.userId) ?? [];
      list.push({ position: badge.position, points: badge.points });
      podiumBadgesByUser.set(badge.userId, list);
    }

    // Fetch podium predictions for this group (to show team crests in standings when locked)
    const podiumPredictions = await prisma.podiumPrediction.findMany({
      where: { groupId },
      select: {
        userId: true,
        firstPlaceTeam: { select: { id: true, name: true, crest: true } },
        secondPlaceTeam: { select: { id: true, name: true, crest: true } },
        thirdPlaceTeam: { select: { id: true, name: true, crest: true } },
      },
    });

    // Check if podium predictions are locked (tournament has started)
    const podiumLocked =
      podiumPredictions.length > 0
        ? !!(await prisma.match.findFirst({
            where: {
              contestId: group.contestId,
              OR: [
                { status: { notIn: ["SCHEDULED", "TIMED"] } },
                { kickoffTime: { lte: new Date() } },
              ],
            },
            select: { id: true },
          }))
        : false;

    const podiumByUser = new Map<
      string,
      {
        firstPlaceTeam: {
          id: string;
          name: string;
          crest: string | null;
          eliminated: boolean;
        } | null;
        secondPlaceTeam: {
          id: string;
          name: string;
          crest: string | null;
          eliminated: boolean;
        } | null;
        thirdPlaceTeam: {
          id: string;
          name: string;
          crest: string | null;
          eliminated: boolean;
        } | null;
      }
    >();
    if (podiumLocked) {
      // Derive which picked teams are eliminated so the UI can gray out their
      // flags. A team is alive while it has an upcoming match; it becomes
      // eliminated once it has no upcoming match and lost its last knockout match.
      const contestMatches = await prisma.match.findMany({
        where: { contestId: group.contestId },
        select: {
          stage: true,
          status: true,
          kickoffTime: true,
          homeTeamId: true,
          awayTeamId: true,
          homeGoals: true,
          awayGoals: true,
        },
      });
      const eliminatedTeamIds = computeEliminatedTeamIds(contestMatches);

      const withStatus = (team: { id: string; name: string; crest: string | null } | null) =>
        team ? { ...team, eliminated: eliminatedTeamIds.has(team.id) } : null;

      for (const pred of podiumPredictions) {
        podiumByUser.set(pred.userId, {
          firstPlaceTeam: withStatus(pred.firstPlaceTeam),
          secondPlaceTeam: withStatus(pred.secondPlaceTeam),
          thirdPlaceTeam: withStatus(pred.thirdPlaceTeam),
        });
      }
    }

    // Build ranked standings
    const standings = members
      .map((m) => {
        const stats = totals.get(m.user.id) ?? { total: 0, scored: 0, lastRound: 0, bonus: 0 };
        const riskPoints = riskPointsByUser.get(m.user.id) ?? 0;
        return {
          userId: m.user.id,
          userName: m.user.name,
          userImage: m.user.image,
          role: m.role,
          totalPoints: stats.total + riskPoints,
          totalBonusPoints: stats.bonus,
          riskPoints,
          predictionsScored: stats.scored,
          lastRoundPoints: stats.lastRound,
          medals: medalsByUser.get(m.user.id) ?? [],
          podiumBadges: podiumBadgesByUser.get(m.user.id) ?? [],
          podiumPicks: podiumByUser.get(m.user.id) ?? null,
        };
      })
      .sort((a, b) => {
        // Primary: total points descending
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        // Tiebreaker: more predictions scored = higher
        return b.predictionsScored - a.predictionsScored;
      })
      .map((entry, index) => ({
        rank: index + 1,
        ...entry,
      }));

    // Determine the selected round key for the client
    let selectedRoundKey: string | null = null;
    if (selectedMatchDay != null) {
      selectedRoundKey = `md:${selectedMatchDay}`;
    } else if (selectedStage != null) {
      selectedRoundKey = `stage:${selectedStage}`;
    }

    return NextResponse.json({
      standings,
      riskEnabled,
      rounds,
      matchDays: sortedMatchDays,
      lastMatchDay: latestMatchDay,
      selectedMatchDay,
      selectedRoundKey,
    });
  } catch (error) {
    console.error("Failed to fetch standings:", error);
    return NextResponse.json({ error: "Failed to fetch standings" }, { status: 500 });
  }
}

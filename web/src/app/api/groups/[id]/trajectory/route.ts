import { NextRequest, NextResponse } from "next/server";
import { RiskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getActiveGroupInfo } from "@/lib/rounds";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/groups/:id/trajectory
 *
 * Returns cumulative points per user across all played match days,
 * ordered chronologically. Each data point includes match info for tooltips.
 *
 * Only visible to group members.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;

    // Check group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { contestId: true, riskEnabled: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    const riskEnabled = group.riskEnabled === true;

    // Only members can view trajectory
    const membership = await prisma.membership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    // Determine active sub-tournament
    const allContestMatches = await prisma.match.findMany({
      where: { contestId: group.contestId },
      select: { group: true, kickoffTime: true },
    });
    const { activeGroup, nullGroupCutoff } = getActiveGroupInfo(allContestMatches);

    // Get all finished matches in chronological order
    const matchWhere: Record<string, unknown> = {
      contestId: group.contestId,
      status: { in: ["FINISHED", "AWARDED"] },
    };
    if (activeGroup) {
      if (nullGroupCutoff) {
        matchWhere.OR = [
          { group: activeGroup },
          { group: null, kickoffTime: { gte: nullGroupCutoff } },
        ];
      } else {
        matchWhere.OR = [{ group: activeGroup }, { group: null }];
      }
    }

    const matches = await prisma.match.findMany({
      where: matchWhere,
      orderBy: [{ kickoffTime: "asc" }],
      select: {
        id: true,
        matchDay: true,
        stage: true,
        kickoffTime: true,
        homeGoals: true,
        awayGoals: true,
        homeTeam: { select: { name: true, shortName: true, crest: true } },
        awayTeam: { select: { name: true, shortName: true, crest: true } },
      },
    });

    if (matches.length === 0) {
      return NextResponse.json({ trajectory: [], users: [], currentUserId: userId });
    }

    // Get all members
    const members = await prisma.membership.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    // Get all scored predictions for these matches
    const matchIds = matches.map((m) => m.id);
    const predictions = await prisma.prediction.findMany({
      where: {
        groupId,
        matchId: { in: matchIds },
        pointsAwarded: { not: null },
      },
      select: {
        matchId: true,
        userId: true,
        homeGoals: true,
        awayGoals: true,
        pointsAwarded: true,
        bonusPoints: true,
      },
    });

    // Index predictions by matchId+userId
    const predMap = new Map<string, (typeof predictions)[0]>();
    for (const p of predictions) {
      predMap.set(`${p.matchId}:${p.userId}`, p);
    }

    // Get resolved risk-it predictions for these matches and build per-match
    // per-user point deltas (WON net = pointsAwarded - pointsRisked, LOST = -pointsRisked).
    const riskDeltaMap = new Map<string, number>();
    if (riskEnabled) {
      const riskPredictions = await prisma.riskPrediction.findMany({
        where: {
          groupId,
          matchId: { in: matchIds },
          status: { in: [RiskStatus.WON, RiskStatus.LOST] },
        },
        select: {
          matchId: true,
          userId: true,
          status: true,
          pointsRisked: true,
          pointsAwarded: true,
        },
      });

      for (const r of riskPredictions) {
        const delta =
          r.status === RiskStatus.WON ? (r.pointsAwarded ?? 0) - r.pointsRisked : -r.pointsRisked;
        const key = `${r.matchId}:${r.userId}`;
        riskDeltaMap.set(key, (riskDeltaMap.get(key) ?? 0) + delta);
      }
    }

    // Build trajectory: for each match, compute cumulative points per user
    const userIds = members.map((m) => m.user.id);
    const cumulativePoints = new Map<string, number>();
    for (const uid of userIds) {
      cumulativePoints.set(uid, 0);
    }

    const trajectory = matches.map((match) => {
      const matchData: Record<string, unknown> = {
        matchId: match.id,
        matchDay: match.matchDay,
        stage: match.stage,
        kickoffTime: match.kickoffTime,
        homeGoals: match.homeGoals,
        awayGoals: match.awayGoals,
        homeTeam: match.homeTeam.shortName || match.homeTeam.name,
        awayTeam: match.awayTeam.shortName || match.awayTeam.name,
        homeTeamCrest: match.homeTeam.crest,
        awayTeamCrest: match.awayTeam.crest,
      };

      // Per-user data for this match
      const userPoints: Record<
        string,
        { cumulative: number; matchPoints: number | null; prediction: string | null }
      > = {};

      for (const uid of userIds) {
        const pred = predMap.get(`${match.id}:${uid}`);
        const predPts = pred ? (pred.pointsAwarded ?? 0) + (pred.bonusPoints ?? 0) : 0;
        const riskDelta = riskDeltaMap.get(`${match.id}:${uid}`) ?? 0;
        const pts = predPts + riskDelta;
        const prev = cumulativePoints.get(uid) ?? 0;
        const newTotal = prev + pts;
        cumulativePoints.set(uid, newTotal);

        const hasActivity = pred != null || riskDelta !== 0;
        userPoints[uid] = {
          cumulative: newTotal,
          matchPoints: hasActivity ? pts : null,
          prediction: pred ? `${pred.homeGoals} - ${pred.awayGoals}` : null,
        };
      }

      matchData.users = userPoints;
      return matchData;
    });

    // Build users list
    const users = members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      image: m.user.image,
    }));

    return NextResponse.json({ trajectory, users, currentUserId: userId });
  } catch (error) {
    console.error("Failed to fetch trajectory:", error);
    return NextResponse.json({ error: "Failed to fetch trajectory" }, { status: 500 });
  }
}

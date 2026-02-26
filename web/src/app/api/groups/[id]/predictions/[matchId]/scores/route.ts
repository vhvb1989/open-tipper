import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { calculateScore, isPlayoffStage, type ScoringRulesConfig } from "@/lib/scoring";

type RouteParams = { params: Promise<{ id: string; matchId: string }> };

/**
 * GET /api/groups/:id/predictions/:matchId/scores
 *
 * Returns the points breakdown for every member's prediction on a specific match.
 * Only available for matches that have finished (have a result).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId, matchId } = await params;

    // Verify membership
    const membership = await prisma.membership.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    // Get the group with scoring rules
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { scoringRules: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Get the match
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        contestId: true,
        homeGoals: true,
        awayGoals: true,
        status: true,
        stage: true,
        homeTeam: { select: { id: true, name: true, shortName: true, tla: true, crest: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, tla: true, crest: true } },
      },
    });

    if (!match || match.contestId !== group.contestId) {
      return NextResponse.json(
        { error: "Match not found in this group's contest" },
        { status: 404 },
      );
    }

    if (match.homeGoals === null || match.awayGoals === null) {
      return NextResponse.json({ error: "Match has not finished yet" }, { status: 400 });
    }

    const result = { homeGoals: match.homeGoals, awayGoals: match.awayGoals };
    const isPlayoff = isPlayoffStage(match.stage);

    // Build scoring rules config
    const rules: ScoringRulesConfig = group.scoringRules
      ? {
          exactScore: group.scoringRules.exactScore,
          goalDifference: group.scoringRules.goalDifference,
          outcome: group.scoringRules.outcome,
          oneTeamGoals: group.scoringRules.oneTeamGoals,
          totalGoals: group.scoringRules.totalGoals,
          reverseGoalDifference: group.scoringRules.reverseGoalDifference,
          accumulationMode: group.scoringRules.accumulationMode,
          playoffMultiplier: group.scoringRules.playoffMultiplier,
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

    // Get all predictions for this match in this group
    const predictions = await prisma.prediction.findMany({
      where: { groupId, matchId },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
      orderBy: { pointsAwarded: { sort: "desc", nulls: "last" } },
    });

    // Calculate breakdowns
    const scores = predictions.map((pred) => {
      const breakdown = calculateScore(
        { homeGoals: pred.homeGoals, awayGoals: pred.awayGoals },
        result,
        rules,
        isPlayoff,
      );

      return {
        userId: pred.user.id,
        userName: pred.user.name,
        userImage: pred.user.image,
        prediction: {
          homeGoals: pred.homeGoals,
          awayGoals: pred.awayGoals,
        },
        breakdown,
        pointsAwarded: pred.pointsAwarded,
      };
    });

    return NextResponse.json({
      match: {
        id: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        result,
        stage: match.stage,
        isPlayoff,
      },
      scores,
      rules,
    });
  } catch (error) {
    console.error("Failed to fetch match scores:", error);
    return NextResponse.json({ error: "Failed to fetch scores" }, { status: 500 });
  }
}

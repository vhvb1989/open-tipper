import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  calculateScore,
  isPlayoffStage,
  DEFAULT_SCORING_RULES,
  type ScoringRulesConfig,
} from "@/lib/scoring";
import { buildRounds, getActiveGroupInfo } from "@/lib/rounds";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/groups/:id/results
 *
 * Returns finished matches with all members' predictions and points.
 * Matches are grouped by match day, ordered newest first.
 * Supports optional matchDay or stage query param for filtering.
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

    // Get the group with its scoring rules
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        contestId: true,
        visibility: true,
        scoringRules: true,
      },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

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

    // Determine active sub-tournament (e.g. Clausura vs Apertura)
    const allContestMatches = await prisma.match.findMany({
      where: { contestId: group.contestId },
      select: { group: true, kickoffTime: true },
    });
    const { activeGroup, includeNullGroup } = getActiveGroupInfo(allContestMatches);

    // Build unified rounds list from played matches in the active sub-tournament
    const playedWhere: Record<string, unknown> = {
      contestId: group.contestId,
      status: { in: ["FINISHED", "AWARDED", "IN_PLAY", "PAUSED"] },
    };
    if (activeGroup) {
      if (includeNullGroup) {
        playedWhere.OR = [{ group: activeGroup }, { group: null }];
      } else {
        playedWhere.group = activeGroup;
      }
    }
    const allPlayedMatches = await prisma.match.findMany({
      where: playedWhere,
      select: { matchDay: true, stage: true, kickoffTime: true },
      orderBy: { kickoffTime: "asc" },
    });
    const rounds = buildRounds(allPlayedMatches);

    // Legacy: numeric matchDays (descending) for backward compat
    const matchDays = rounds
      .filter((r) => r.type === "matchDay")
      .map((r) => r.matchDay!)
      .sort((a, b) => b - a);

    // Determine which round to show
    let effectiveMatchDay: number | null = null;
    let effectiveStage: string | null = null;

    if (matchDayParam) {
      effectiveMatchDay = parseInt(matchDayParam, 10);
    } else if (stageParam) {
      effectiveStage = stageParam;
    } else if (rounds.length > 0) {
      // Default to the latest played round (last in the list by kickoff order)
      // But for results, we show newest first → pick the last round
      const latestRound = rounds[rounds.length - 1];
      if (latestRound.type === "matchDay") {
        effectiveMatchDay = latestRound.matchDay;
      } else {
        effectiveStage = latestRound.stage;
      }
    }

    // Build match filter: finished + live matches in this contest
    const matchWhere: Record<string, unknown> = {
      contestId: group.contestId,
      status: { in: ["FINISHED", "AWARDED", "IN_PLAY", "PAUSED"] },
    };
    if (activeGroup) {
      if (includeNullGroup) {
        matchWhere.OR = [{ group: activeGroup }, { group: null }];
      } else {
        matchWhere.group = activeGroup;
      }
    }
    if (effectiveMatchDay !== null) {
      matchWhere.matchDay = effectiveMatchDay;
    } else if (effectiveStage !== null) {
      matchWhere.stage = effectiveStage;
      matchWhere.matchDay = null;
    }

    // Get finished matches with team info
    const matches = await prisma.match.findMany({
      where: matchWhere,
      orderBy: [{ matchDay: { sort: "desc", nulls: "last" } }, { kickoffTime: "desc" }],
      select: {
        id: true,
        matchDay: true,
        stage: true,
        status: true,
        kickoffTime: true,
        homeGoals: true,
        awayGoals: true,
        homeTeam: { select: { id: true, name: true, shortName: true, tla: true, crest: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, tla: true, crest: true } },
      },
    });

    if (matches.length === 0) {
      return NextResponse.json({ results: [], matchDays: [], rounds });
    }

    // Get all predictions for these matches in this group
    const matchIds = matches.map((m) => m.id);
    const predictions = await prisma.prediction.findMany({
      where: {
        groupId,
        matchId: { in: matchIds },
      },
      select: {
        matchId: true,
        homeGoals: true,
        awayGoals: true,
        pointsAwarded: true,
        user: { select: { id: true, name: true, image: true } },
      },
      orderBy: [{ pointsAwarded: { sort: "desc", nulls: "last" } }],
    });

    // Build scoring rules config for this group
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
      : DEFAULT_SCORING_RULES;

    // Build a lookup for match results
    const matchById = new Map(matches.map((m) => [m.id, m]));

    // Group predictions by matchId, with scoring breakdown
    const predsByMatch = new Map<
      string,
      Array<{
        userId: string;
        userName: string | null;
        userImage: string | null;
        homeGoals: number;
        awayGoals: number;
        pointsAwarded: number | null;
        breakdown: {
          exactScore: number;
          goalDifference: number;
          outcome: number;
          oneTeamGoals: number;
          totalGoals: number;
          reverseGoalDifference: number;
        } | null;
      }>
    >();
    for (const p of predictions) {
      if (!predsByMatch.has(p.matchId)) {
        predsByMatch.set(p.matchId, []);
      }

      // Calculate scoring breakdown if match has a result
      const match = matchById.get(p.matchId);
      let breakdown = null;
      if (match && match.homeGoals !== null && match.awayGoals !== null) {
        const result = { homeGoals: match.homeGoals, awayGoals: match.awayGoals };
        const pred = { homeGoals: p.homeGoals, awayGoals: p.awayGoals };
        const scored = calculateScore(pred, result, rules, isPlayoffStage(match.stage));
        breakdown = {
          exactScore: scored.exactScore,
          goalDifference: scored.goalDifference,
          outcome: scored.outcome,
          oneTeamGoals: scored.oneTeamGoals,
          totalGoals: scored.totalGoals,
          reverseGoalDifference: scored.reverseGoalDifference,
        };
      }

      predsByMatch.get(p.matchId)!.push({
        userId: p.user.id,
        userName: p.user.name,
        userImage: p.user.image,
        homeGoals: p.homeGoals,
        awayGoals: p.awayGoals,
        pointsAwarded: p.pointsAwarded,
        breakdown,
      });
    }

    // Build results with predictions attached
    const results = matches.map((match) => ({
      ...match,
      predictions: predsByMatch.get(match.id) ?? [],
    }));

    return NextResponse.json({ results, matchDays, rounds });
  } catch (error) {
    console.error("Failed to fetch results:", error);
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
  }
}

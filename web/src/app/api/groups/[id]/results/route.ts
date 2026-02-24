import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/groups/:id/results
 *
 * Returns finished matches with all members' predictions and points.
 * Matches are grouped by match day, ordered newest first.
 * Supports optional matchDay query param for filtering.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;
    const { searchParams } = new URL(request.url);
    const matchDayParam = searchParams.get("matchDay");

    // Verify membership
    const membership = await prisma.membership.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    // Get the group
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { contestId: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Query all available finished match days (independent of filter)
    const allFinishedMatchDays = await prisma.match.findMany({
      where: {
        contestId: group.contestId,
        status: { in: ["FINISHED", "AWARDED"] },
        homeGoals: { not: null },
        awayGoals: { not: null },
        matchDay: { not: null },
      },
      select: { matchDay: true },
      distinct: ["matchDay"],
      orderBy: { matchDay: "desc" },
    });
    const matchDays = allFinishedMatchDays
      .map((m) => m.matchDay)
      .filter((d): d is number => d !== null)
      .sort((a, b) => b - a);

    // Determine which match day to show
    // Default to the latest finished match day when no param is provided
    const effectiveMatchDay = matchDayParam
      ? parseInt(matchDayParam, 10)
      : matchDays[0] ?? null;

    // Build match filter: finished matches in this contest
    const matchWhere: Record<string, unknown> = {
      contestId: group.contestId,
      status: { in: ["FINISHED", "AWARDED"] },
      homeGoals: { not: null },
      awayGoals: { not: null },
    };
    if (effectiveMatchDay !== null) {
      matchWhere.matchDay = effectiveMatchDay;
    }

    // Get finished matches with team info
    const matches = await prisma.match.findMany({
      where: matchWhere,
      orderBy: [{ matchDay: { sort: "desc", nulls: "last" } }, { kickoffTime: "desc" }],
      select: {
        id: true,
        matchDay: true,
        stage: true,
        kickoffTime: true,
        homeGoals: true,
        awayGoals: true,
        homeTeam: { select: { id: true, name: true, shortName: true, tla: true, crest: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, tla: true, crest: true } },
      },
    });

    if (matches.length === 0) {
      return NextResponse.json({ results: [], matchDays: [] });
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

    // Group predictions by matchId
    const predsByMatch = new Map<
      string,
      Array<{
        userId: string;
        userName: string | null;
        userImage: string | null;
        homeGoals: number;
        awayGoals: number;
        pointsAwarded: number | null;
      }>
    >();
    for (const p of predictions) {
      if (!predsByMatch.has(p.matchId)) {
        predsByMatch.set(p.matchId, []);
      }
      predsByMatch.get(p.matchId)!.push({
        userId: p.user.id,
        userName: p.user.name,
        userImage: p.user.image,
        homeGoals: p.homeGoals,
        awayGoals: p.awayGoals,
        pointsAwarded: p.pointsAwarded,
      });
    }

    // Build results with predictions attached
    const results = matches.map((match) => ({
      ...match,
      predictions: predsByMatch.get(match.id) ?? [],
    }));

    return NextResponse.json({ results, matchDays });
  } catch (error) {
    console.error("Failed to fetch results:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/groups/:id/podium
 *
 * Returns podium settings, current user's prediction, lock status,
 * available teams, and results (if tournament is complete).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        podiumSettings: true,
        contest: {
          select: { id: true, code: true, status: true },
        },
        memberships: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (!group.podiumSettings?.enabled) {
      return NextResponse.json({ error: "Podium predictions not enabled" }, { status: 404 });
    }

    const isMember = group.memberships.length > 0;
    if (group.visibility === "PRIVATE" && !isMember) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Determine if predictions are locked (first match has started)
    const firstStartedMatch = await prisma.match.findFirst({
      where: {
        contestId: group.contest.id,
        OR: [
          { status: { notIn: ["SCHEDULED", "TIMED"] } },
          { kickoffTime: { lte: new Date() } },
        ],
      },
      select: { id: true },
    });
    const isLocked = !!firstStartedMatch;

    // Get current user's prediction
    const userPrediction = isMember
      ? await prisma.podiumPrediction.findUnique({
          where: { userId_groupId: { userId: session.user.id, groupId: id } },
          include: {
            firstPlaceTeam: { select: { id: true, name: true, crest: true } },
            secondPlaceTeam: { select: { id: true, name: true, crest: true } },
            thirdPlaceTeam: { select: { id: true, name: true, crest: true } },
          },
        })
      : null;

    // Get all teams in the contest
    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { homeMatches: { some: { contestId: group.contest.id } } },
          { awayMatches: { some: { contestId: group.contest.id } } },
        ],
      },
      select: { id: true, name: true, crest: true },
      orderBy: { name: "asc" },
    });

    // If tournament is complete and scored, include all members' predictions
    let allPredictions = null;
    let podiumBadges = null;
    const isComplete = group.contest.status === "COMPLETED";

    if (isComplete || (isLocked && userPrediction?.scoredAt)) {
      allPredictions = await prisma.podiumPrediction.findMany({
        where: { groupId: id },
        include: {
          user: { select: { id: true, name: true, image: true } },
          firstPlaceTeam: { select: { id: true, name: true, crest: true } },
          secondPlaceTeam: { select: { id: true, name: true, crest: true } },
          thirdPlaceTeam: { select: { id: true, name: true, crest: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      podiumBadges = await prisma.podiumBadge.findMany({
        where: { groupId: id },
        include: {
          user: { select: { id: true, name: true } },
        },
      });
    }

    return NextResponse.json({
      podiumSettings: group.podiumSettings,
      userPrediction,
      isLocked,
      teams,
      allPredictions,
      podiumBadges,
      isComplete,
    });
  } catch (error) {
    console.error("Failed to fetch podium data:", error);
    return NextResponse.json({ error: "Failed to fetch podium data" }, { status: 500 });
  }
}

/**
 * PUT /api/groups/:id/podium
 *
 * Submit or update a podium prediction.
 * Body: { firstPlaceTeamId, secondPlaceTeamId, thirdPlaceTeamId? }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify membership
    const membership = await prisma.membership.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId: id } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    // Load group with podium settings and contest
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        podiumSettings: true,
        contest: { select: { id: true, code: true } },
      },
    });

    if (!group || !group.podiumSettings?.enabled) {
      return NextResponse.json({ error: "Podium predictions not enabled" }, { status: 400 });
    }

    // Check if locked (first match has started)
    const firstStartedMatch = await prisma.match.findFirst({
      where: {
        contestId: group.contest.id,
        OR: [
          { status: { notIn: ["SCHEDULED", "TIMED"] } },
          { kickoffTime: { lte: new Date() } },
        ],
      },
      select: { id: true },
    });

    if (firstStartedMatch) {
      return NextResponse.json(
        { error: "Predictions are locked — the tournament has already started" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { firstPlaceTeamId, secondPlaceTeamId, thirdPlaceTeamId } = body;

    if (!firstPlaceTeamId || !secondPlaceTeamId) {
      return NextResponse.json(
        { error: "1st and 2nd place predictions are required" },
        { status: 400 },
      );
    }

    // Validate no duplicate teams
    const selectedTeams = [firstPlaceTeamId, secondPlaceTeamId, thirdPlaceTeamId].filter(Boolean);
    if (new Set(selectedTeams).size !== selectedTeams.length) {
      return NextResponse.json(
        { error: "Each position must have a different team" },
        { status: 400 },
      );
    }

    // Validate teams exist in this contest
    const contestTeams = await prisma.team.findMany({
      where: {
        id: { in: selectedTeams },
        OR: [
          { homeMatches: { some: { contestId: group.contest.id } } },
          { awayMatches: { some: { contestId: group.contest.id } } },
        ],
      },
      select: { id: true },
    });

    if (contestTeams.length !== selectedTeams.length) {
      return NextResponse.json(
        { error: "One or more selected teams are not in this tournament" },
        { status: 400 },
      );
    }

    // Only accept 3rd place if it's enabled (World Cup)
    const thirdTeamId = group.podiumSettings.thirdPlaceEnabled ? (thirdPlaceTeamId ?? null) : null;

    const prediction = await prisma.podiumPrediction.upsert({
      where: { userId_groupId: { userId: session.user.id, groupId: id } },
      create: {
        userId: session.user.id,
        groupId: id,
        firstPlaceTeamId,
        secondPlaceTeamId,
        thirdPlaceTeamId: thirdTeamId,
      },
      update: {
        firstPlaceTeamId,
        secondPlaceTeamId,
        thirdPlaceTeamId: thirdTeamId,
      },
      include: {
        firstPlaceTeam: { select: { id: true, name: true, crest: true } },
        secondPlaceTeam: { select: { id: true, name: true, crest: true } },
        thirdPlaceTeam: { select: { id: true, name: true, crest: true } },
      },
    });

    return NextResponse.json({ prediction });
  } catch (error) {
    console.error("Failed to save podium prediction:", error);
    return NextResponse.json({ error: "Failed to save prediction" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/groups/:id/predictions
 *
 * Get the current user's predictions for a group.
 * Returns predictions keyed by matchId for easy lookup.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
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

    const predictions = await prisma.prediction.findMany({
      where: { groupId: id, userId: session.user.id },
      select: {
        id: true,
        matchId: true,
        homeGoals: true,
        awayGoals: true,
        pointsAwarded: true,
        updatedAt: true,
      },
    });

    // Key by matchId for easy client-side lookup
    const byMatch: Record<
      string,
      { homeGoals: number; awayGoals: number; pointsAwarded: number | null }
    > = {};
    for (const p of predictions) {
      byMatch[p.matchId] = {
        homeGoals: p.homeGoals,
        awayGoals: p.awayGoals,
        pointsAwarded: p.pointsAwarded,
      };
    }

    return NextResponse.json({ predictions: byMatch });
  } catch (error) {
    console.error("Failed to fetch predictions:", error);
    return NextResponse.json({ error: "Failed to fetch predictions" }, { status: 500 });
  }
}

/**
 * PUT /api/groups/:id/predictions
 *
 * Upsert a prediction for a match. Rejects if match has already kicked off.
 *
 * Body: { matchId: string, homeGoals: number, awayGoals: number }
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

    const body = await request.json();
    const { matchId, homeGoals, awayGoals } = body;

    // Validate input
    if (!matchId || typeof matchId !== "string") {
      return NextResponse.json({ error: "Match ID is required" }, { status: 400 });
    }
    if (typeof homeGoals !== "number" || homeGoals < 0 || !Number.isInteger(homeGoals)) {
      return NextResponse.json(
        { error: "Home goals must be a non-negative integer" },
        { status: 400 },
      );
    }
    if (typeof awayGoals !== "number" || awayGoals < 0 || !Number.isInteger(awayGoals)) {
      return NextResponse.json(
        { error: "Away goals must be a non-negative integer" },
        { status: 400 },
      );
    }

    // Verify match exists and belongs to this group's contest
    const group = await prisma.group.findUnique({
      where: { id },
      select: { contestId: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, contestId: true, kickoffTime: true, status: true },
    });
    if (!match || match.contestId !== group.contestId) {
      return NextResponse.json(
        { error: "Match not found in this group's contest" },
        { status: 404 },
      );
    }

    // Check kickoff lock
    const now = new Date();
    if (match.kickoffTime <= now) {
      return NextResponse.json({ error: "Predictions are locked after kick-off" }, { status: 403 });
    }

    // Also check match status — don't allow for in-progress or finished matches
    const lockedStatuses = ["IN_PLAY", "PAUSED", "FINISHED", "AWARDED"];
    if (lockedStatuses.includes(match.status)) {
      return NextResponse.json({ error: "Predictions are locked for this match" }, { status: 403 });
    }

    // Upsert prediction
    const prediction = await prisma.prediction.upsert({
      where: {
        userId_groupId_matchId: {
          userId: session.user.id,
          groupId: id,
          matchId,
        },
      },
      update: { homeGoals, awayGoals },
      create: {
        userId: session.user.id,
        groupId: id,
        matchId,
        homeGoals,
        awayGoals,
      },
    });

    return NextResponse.json({
      prediction: {
        matchId: prediction.matchId,
        homeGoals: prediction.homeGoals,
        awayGoals: prediction.awayGoals,
      },
    });
  } catch (error) {
    console.error("Failed to save prediction:", error);
    return NextResponse.json({ error: "Failed to save prediction" }, { status: 500 });
  }
}

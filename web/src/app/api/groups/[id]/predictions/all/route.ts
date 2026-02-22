import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/groups/:id/predictions/all
 *
 * Get all members' predictions for a group. Only returns predictions
 * for matches that have started or finished (to prevent seeing others'
 * predictions before kick-off).
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

    // Get the group's contest to find matches
    const group = await prisma.group.findUnique({
      where: { id },
      select: { contestId: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Only return predictions for matches past kick-off
    const now = new Date();
    const predictions = await prisma.prediction.findMany({
      where: {
        groupId: id,
        match: {
          kickoffTime: { lte: now },
        },
      },
      select: {
        matchId: true,
        homeGoals: true,
        awayGoals: true,
        pointsAwarded: true,
        user: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: [{ matchId: "asc" }, { user: { name: "asc" } }],
    });

    // Group by matchId
    const byMatch: Record<
      string,
      Array<{
        userId: string;
        userName: string | null;
        userImage: string | null;
        homeGoals: number;
        awayGoals: number;
        pointsAwarded: number | null;
      }>
    > = {};

    for (const p of predictions) {
      if (!byMatch[p.matchId]) {
        byMatch[p.matchId] = [];
      }
      byMatch[p.matchId].push({
        userId: p.user.id,
        userName: p.user.name,
        userImage: p.user.image,
        homeGoals: p.homeGoals,
        awayGoals: p.awayGoals,
        pointsAwarded: p.pointsAwarded,
      });
    }

    return NextResponse.json({ predictions: byMatch });
  } catch (error) {
    console.error("Failed to fetch all predictions:", error);
    return NextResponse.json(
      { error: "Failed to fetch predictions" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/groups/:id/matches
 *
 * Get matches for a group's contest. Supports filtering by matchDay.
 * Returns matches with team details, ordered by kickoff time.
 *
 * Query params:
 *   - matchDay: filter by match day / round number
 *   - status: filter by match status
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const matchDay = searchParams.get("matchDay");

    // Verify membership and get contestId
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (group.visibility === "PRIVATE" && group.memberships.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Build filter
    const where: Record<string, unknown> = { contestId: group.contestId };
    if (matchDay) where.matchDay = parseInt(matchDay, 10);

    const matches = await prisma.match.findMany({
      where,
      orderBy: [{ kickoffTime: "asc" }],
      include: {
        homeTeam: {
          select: { id: true, name: true, shortName: true, tla: true, crest: true },
        },
        awayTeam: {
          select: { id: true, name: true, shortName: true, tla: true, crest: true },
        },
      },
    });

    // Get distinct match days for navigation
    const matchDays = await prisma.match.findMany({
      where: { contestId: group.contestId },
      select: { matchDay: true },
      distinct: ["matchDay"],
      orderBy: { matchDay: "asc" },
    });

    const availableMatchDays = matchDays
      .map((m) => m.matchDay)
      .filter((d): d is number => d !== null);

    return NextResponse.json({
      matches,
      matchDays: availableMatchDays,
      currentMatchDay: matchDay ? parseInt(matchDay, 10) : null,
    });
  } catch (error) {
    console.error("Failed to fetch group matches:", error);
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }
}

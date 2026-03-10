import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/groups/:id/standings
 *
 * Returns a ranked leaderboard for the group. Aggregates pointsAwarded
 * from all scored predictions per member. Includes total points, number of
 * predictions scored, and per-match-day breakdown for "last round" display.
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
    const matchDay = searchParams.get("matchDay");

    // Get the group with contest info and visibility
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { contestId: true, visibility: true },
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

    // Get all members
    const members = await prisma.membership.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    // Get all scored predictions (with match info for match-day breakdown)
    const predictions = await prisma.prediction.findMany({
      where: {
        groupId,
        pointsAwarded: { not: null },
      },
      select: {
        userId: true,
        pointsAwarded: true,
        match: {
          select: { matchDay: true },
        },
      },
    });

    // Determine the latest match day that has been scored
    const scoredMatchDays = new Set<number>();
    for (const p of predictions) {
      if (p.match.matchDay != null) {
        scoredMatchDays.add(p.match.matchDay);
      }
    }
    const sortedMatchDays = [...scoredMatchDays].sort((a, b) => a - b);
    const latestMatchDay = sortedMatchDays[sortedMatchDays.length - 1] ?? null;
    const selectedMatchDay = matchDay ? parseInt(matchDay, 10) : latestMatchDay;

    // Aggregate points per user
    const totals = new Map<string, { total: number; scored: number; lastRound: number }>();

    // Initialize all members with 0
    for (const m of members) {
      totals.set(m.user.id, { total: 0, scored: 0, lastRound: 0 });
    }

    for (const p of predictions) {
      const entry = totals.get(p.userId);
      if (!entry) continue;
      const pts = p.pointsAwarded ?? 0;
      entry.total += pts;
      entry.scored += 1;
      if (selectedMatchDay != null && p.match.matchDay === selectedMatchDay) {
        entry.lastRound += pts;
      }
    }

    // Fetch medals for this group
    const medals = await prisma.medal.findMany({
      where: { groupId },
      select: { userId: true, matchDay: true, points: true },
      orderBy: { matchDay: "asc" },
    });

    // Group medals by userId
    const medalsByUser = new Map<string, { matchDay: number; points: number }[]>();
    for (const medal of medals) {
      const list = medalsByUser.get(medal.userId) ?? [];
      list.push({ matchDay: medal.matchDay, points: medal.points });
      medalsByUser.set(medal.userId, list);
    }

    // Build ranked standings
    const standings = members
      .map((m) => {
        const stats = totals.get(m.user.id) ?? { total: 0, scored: 0, lastRound: 0 };
        return {
          userId: m.user.id,
          userName: m.user.name,
          userImage: m.user.image,
          role: m.role,
          totalPoints: stats.total,
          predictionsScored: stats.scored,
          lastRoundPoints: stats.lastRound,
          medals: medalsByUser.get(m.user.id) ?? [],
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

    return NextResponse.json({
      standings,
      matchDays: sortedMatchDays,
      lastMatchDay: latestMatchDay,
      selectedMatchDay,
    });
  } catch (error) {
    console.error("Failed to fetch standings:", error);
    return NextResponse.json({ error: "Failed to fetch standings" }, { status: 500 });
  }
}

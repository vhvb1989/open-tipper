import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { buildRounds } from "@/lib/rounds";

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
        firstPlaceTeam: { id: string; name: string; crest: string | null } | null;
        secondPlaceTeam: { id: string; name: string; crest: string | null } | null;
        thirdPlaceTeam: { id: string; name: string; crest: string | null } | null;
      }
    >();
    if (podiumLocked) {
      for (const pred of podiumPredictions) {
        podiumByUser.set(pred.userId, {
          firstPlaceTeam: pred.firstPlaceTeam,
          secondPlaceTeam: pred.secondPlaceTeam,
          thirdPlaceTeam: pred.thirdPlaceTeam,
        });
      }
    }

    // Build ranked standings
    const standings = members
      .map((m) => {
        const stats = totals.get(m.user.id) ?? { total: 0, scored: 0, lastRound: 0, bonus: 0 };
        return {
          userId: m.user.id,
          userName: m.user.name,
          userImage: m.user.image,
          role: m.role,
          totalPoints: stats.total,
          totalBonusPoints: stats.bonus,
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

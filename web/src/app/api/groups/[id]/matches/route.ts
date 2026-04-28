import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { buildRounds, getActiveGroupInfo } from "@/lib/rounds";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/groups/:id/matches
 *
 * Get matches for a group's contest. Supports filtering by matchDay or stage.
 * Returns matches with team details, ordered by kickoff time.
 *
 * Query params:
 *   - matchDay: filter by match day / round number
 *   - stage: filter by exact stage string (for playoff rounds)
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
    const stage = searchParams.get("stage");

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

    // Determine active sub-tournament (e.g. Clausura vs Apertura).
    const allContestMatches = await prisma.match.findMany({
      where: { contestId: group.contestId },
      select: { matchDay: true, stage: true, kickoffTime: true, group: true },
      orderBy: { kickoffTime: "asc" },
    });
    const { activeGroup, includeNullGroup } = getActiveGroupInfo(allContestMatches);

    // Filter to active sub-tournament matches for building rounds
    const activeMatches = activeGroup
      ? allContestMatches.filter(
          (m) => m.group === activeGroup || (m.group === null && includeNullGroup),
        )
      : allContestMatches;

    const rounds = buildRounds(activeMatches);

    // Build filter — always scoped to the active sub-tournament
    const where: Record<string, unknown> = { contestId: group.contestId };
    if (activeGroup) {
      if (includeNullGroup) {
        where.OR = [{ group: activeGroup }, { group: null }];
      } else {
        where.group = activeGroup;
      }
    }
    if (matchDay) {
      where.matchDay = parseInt(matchDay, 10);
    } else if (stage) {
      where.stage = stage;
      where.matchDay = null;
    }

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

    // Legacy: also return numeric matchDays for backward compat
    const availableMatchDays = rounds.filter((r) => r.type === "matchDay").map((r) => r.matchDay!);

    // Compute W-L-D records from finished matches in the same sub-tournament.
    // The `group` column stores the round prefix (e.g. "Clausura", "League Stage")
    // so we filter to the active sub-tournament to avoid mixing results from
    // different phases (e.g. Apertura + Clausura) or knockout rounds.
    const activeGroups = [
      ...new Set(matches.map((m) => m.group).filter((g): g is string => g !== null)),
    ];

    const recordWhere: Record<string, unknown> = {
      contestId: group.contestId,
      status: "FINISHED",
      matchDay: { not: null },
    };
    if (activeGroups.length > 0) {
      recordWhere.group = { in: activeGroups };
    }

    const finishedMatches = await prisma.match.findMany({
      where: recordWhere,
      select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true },
    });

    const teamRecords: Record<string, { wins: number; losses: number; draws: number }> = {};
    const ensure = (id: string) => {
      if (!teamRecords[id]) teamRecords[id] = { wins: 0, losses: 0, draws: 0 };
    };
    for (const m of finishedMatches) {
      if (m.homeGoals == null || m.awayGoals == null) continue;
      ensure(m.homeTeamId);
      ensure(m.awayTeamId);
      if (m.homeGoals > m.awayGoals) {
        teamRecords[m.homeTeamId].wins++;
        teamRecords[m.awayTeamId].losses++;
      } else if (m.homeGoals < m.awayGoals) {
        teamRecords[m.awayTeamId].wins++;
        teamRecords[m.homeTeamId].losses++;
      } else {
        teamRecords[m.homeTeamId].draws++;
        teamRecords[m.awayTeamId].draws++;
      }
    }

    // Attach record to each team in the match list
    const defaultRecord = { wins: 0, losses: 0, draws: 0 };
    const matchesWithRecords = matches.map((m) => ({
      ...m,
      homeTeam: { ...m.homeTeam, record: teamRecords[m.homeTeam.id] ?? defaultRecord },
      awayTeam: { ...m.awayTeam, record: teamRecords[m.awayTeam.id] ?? defaultRecord },
    }));

    return NextResponse.json({
      matches: matchesWithRecords,
      matchDays: availableMatchDays,
      rounds,
      currentMatchDay: matchDay ? parseInt(matchDay, 10) : null,
    });
  } catch (error) {
    console.error("Failed to fetch group matches:", error);
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }
}

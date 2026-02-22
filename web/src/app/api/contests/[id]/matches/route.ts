import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/contests/:id/matches
 *
 * Returns all matches for a contest, with home/away team details.
 * Supports optional query params:
 *   - status: filter by match status (e.g. FINISHED, SCHEDULED)
 *   - matchDay: filter by match day / round number
 *   - stage: filter by stage (e.g. GROUP_STAGE, QUARTER_FINALS)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const matchDay = searchParams.get("matchDay");
    const stage = searchParams.get("stage");

    // Verify contest exists
    const contest = await prisma.contest.findUnique({
      where: { id },
      select: { id: true, name: true, code: true, season: true },
    });

    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Build filter
    const where: Record<string, unknown> = { contestId: id };
    if (status) where.status = status;
    if (matchDay) where.matchDay = parseInt(matchDay, 10);
    if (stage) where.stage = stage;

    const matches = await prisma.match.findMany({
      where,
      orderBy: [{ kickoffTime: "asc" }, { matchDay: "asc" }],
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            tla: true,
            crest: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            tla: true,
            crest: true,
          },
        },
      },
    });

    return NextResponse.json({ contest, matches });
  } catch (error) {
    console.error("Failed to fetch matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 },
    );
  }
}

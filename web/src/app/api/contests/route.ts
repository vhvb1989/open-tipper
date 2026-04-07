import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/contests
 *
 * Returns all contests ordered by start date (most recent first).
 * Includes hasStarted flag and code for podium prediction eligibility.
 */
export async function GET() {
  try {
    const contests = await prisma.contest.findMany({
      orderBy: { startDate: "desc" },
      include: {
        _count: {
          select: { matches: true },
        },
        matches: {
          where: {
            status: { notIn: ["SCHEDULED", "TIMED"] },
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    const result = contests.map((c) => ({
      id: c.id,
      externalId: c.externalId,
      name: c.name,
      code: c.code,
      season: c.season,
      type: c.type,
      emblem: c.emblem,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      _count: c._count,
      hasStarted: c.matches.length > 0,
    }));

    return NextResponse.json({ contests: result });
  } catch (error) {
    console.error("Failed to fetch contests:", error);
    return NextResponse.json({ error: "Failed to fetch contests" }, { status: 500 });
  }
}

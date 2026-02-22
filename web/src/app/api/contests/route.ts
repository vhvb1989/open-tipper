import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/contests
 *
 * Returns all contests ordered by start date (most recent first).
 */
export async function GET() {
  try {
    const contests = await prisma.contest.findMany({
      orderBy: { startDate: "desc" },
      include: {
        _count: {
          select: { matches: true },
        },
      },
    });

    return NextResponse.json({ contests });
  } catch (error) {
    console.error("Failed to fetch contests:", error);
    return NextResponse.json(
      { error: "Failed to fetch contests" },
      { status: 500 },
    );
  }
}

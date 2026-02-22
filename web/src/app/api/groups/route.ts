import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * GET /api/groups
 *
 * Returns the current user's groups with contest info and member counts.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groups = await prisma.group.findMany({
      where: {
        memberships: {
          some: { userId: session.user.id },
        },
      },
      include: {
        contest: { select: { id: true, name: true, code: true, season: true, emblem: true } },
        _count: { select: { memberships: true } },
        memberships: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      visibility: g.visibility,
      contest: g.contest,
      memberCount: g._count.memberships,
      role: g.memberships[0]?.role ?? null,
      createdAt: g.createdAt,
    }));

    return NextResponse.json({ groups: result });
  } catch (error) {
    console.error("Failed to fetch groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch groups" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/groups
 *
 * Create a new group. The current user becomes the admin.
 *
 * Body: { name, description?, contestId, visibility?, scoringRules? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, contestId, visibility, scoringRules } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Group name is required" },
        { status: 400 },
      );
    }

    if (!contestId || typeof contestId !== "string") {
      return NextResponse.json(
        { error: "Contest ID is required" },
        { status: 400 },
      );
    }

    // Verify contest exists
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
    });
    if (!contest) {
      return NextResponse.json(
        { error: "Contest not found" },
        { status: 404 },
      );
    }

    // Create group with admin membership and default scoring rules
    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        contestId,
        visibility: visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE",
        memberships: {
          create: {
            userId: session.user.id,
            role: "ADMIN",
          },
        },
        scoringRules: {
          create: {
            exactScore: scoringRules?.exactScore ?? 10,
            goalDifference: scoringRules?.goalDifference ?? 6,
            outcome: scoringRules?.outcome ?? 4,
            oneTeamGoals: scoringRules?.oneTeamGoals ?? 3,
            totalGoals: scoringRules?.totalGoals ?? 2,
            reverseGoalDifference: scoringRules?.reverseGoalDifference ?? 1,
            accumulationMode: scoringRules?.accumulationMode === "HIGHEST_ONLY" ? "HIGHEST_ONLY" : "ACCUMULATE",
            playoffMultiplier: scoringRules?.playoffMultiplier ?? false,
          },
        },
      },
      include: {
        contest: { select: { id: true, name: true, code: true, season: true } },
        _count: { select: { memberships: true } },
      },
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error("Failed to create group:", error);
    return NextResponse.json(
      { error: "Failed to create group" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/groups/:id
 *
 * Get group details including contest, scoring rules, and member count.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        contest: {
          select: { id: true, name: true, code: true, season: true, emblem: true, status: true },
        },
        scoringRules: true,
        _count: { select: { memberships: true } },
        memberships: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Check access: public groups are visible to all, private groups only to members
    const userRole = group.memberships[0]?.role ?? null;
    if (group.visibility === "PRIVATE" && !userRole) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        visibility: group.visibility,
        inviteCode: userRole === "ADMIN" ? group.inviteCode : undefined,
        contest: group.contest,
        scoringRules: group.scoringRules,
        memberCount: group._count.memberships,
        role: userRole,
        createdAt: group.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to fetch group:", error);
    return NextResponse.json(
      { error: "Failed to fetch group" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/groups/:id
 *
 * Update group settings. Admin only.
 *
 * Body: { name?, description?, visibility?, scoringRules? }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check that user is admin
    const membership = await prisma.membership.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId: id } },
    });
    if (!membership || membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, visibility, scoringRules } = body;

    // Update group
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Group name cannot be empty" },
          { status: 400 },
        );
      }
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }
    if (visibility !== undefined) {
      updateData.visibility = visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE";
    }

    const group = await prisma.group.update({
      where: { id },
      data: updateData,
      include: {
        contest: { select: { id: true, name: true, code: true, season: true } },
        _count: { select: { memberships: true } },
      },
    });

    // Update scoring rules if provided
    if (scoringRules) {
      await prisma.scoringRules.upsert({
        where: { groupId: id },
        update: {
          ...(scoringRules.exactScore !== undefined && { exactScore: scoringRules.exactScore }),
          ...(scoringRules.goalDifference !== undefined && { goalDifference: scoringRules.goalDifference }),
          ...(scoringRules.outcome !== undefined && { outcome: scoringRules.outcome }),
          ...(scoringRules.oneTeamGoals !== undefined && { oneTeamGoals: scoringRules.oneTeamGoals }),
          ...(scoringRules.totalGoals !== undefined && { totalGoals: scoringRules.totalGoals }),
          ...(scoringRules.reverseGoalDifference !== undefined && { reverseGoalDifference: scoringRules.reverseGoalDifference }),
          ...(scoringRules.accumulationMode !== undefined && { accumulationMode: scoringRules.accumulationMode }),
          ...(scoringRules.playoffMultiplier !== undefined && { playoffMultiplier: scoringRules.playoffMultiplier }),
        },
        create: {
          groupId: id,
          exactScore: scoringRules.exactScore ?? 10,
          goalDifference: scoringRules.goalDifference ?? 6,
          outcome: scoringRules.outcome ?? 4,
          oneTeamGoals: scoringRules.oneTeamGoals ?? 3,
          totalGoals: scoringRules.totalGoals ?? 2,
          reverseGoalDifference: scoringRules.reverseGoalDifference ?? 1,
          accumulationMode: scoringRules.accumulationMode ?? "ACCUMULATE",
          playoffMultiplier: scoringRules.playoffMultiplier ?? false,
        },
      });
    }

    return NextResponse.json({ group });
  } catch (error) {
    console.error("Failed to update group:", error);
    return NextResponse.json(
      { error: "Failed to update group" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/groups/:id
 *
 * Delete a group. Admin only.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check that user is admin
    const membership = await prisma.membership.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId: id } },
    });
    if (!membership || membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.group.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete group:", error);
    return NextResponse.json(
      { error: "Failed to delete group" },
      { status: 500 },
    );
  }
}

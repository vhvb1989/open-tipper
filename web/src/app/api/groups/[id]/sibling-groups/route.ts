import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/groups/:id/sibling-groups
 *
 * Returns other groups the current user belongs to for the same contest.
 * Used to detect multi-group scenarios and enable cross-group prediction sync.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the current group's contest
    const currentGroup = await prisma.group.findUnique({
      where: { id },
      select: { id: true, contestId: true },
    });
    if (!currentGroup) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Verify the user is a member of this group
    const membership = await prisma.membership.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId: id } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    // Find other groups the user belongs to for the same contest
    const siblingGroups = await prisma.group.findMany({
      where: {
        contestId: currentGroup.contestId,
        id: { not: id },
        memberships: {
          some: { userId: session.user.id },
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ groups: siblingGroups });
  } catch (error) {
    console.error("Failed to fetch sibling groups:", error);
    return NextResponse.json({ error: "Failed to fetch sibling groups" }, { status: 500 });
  }
}

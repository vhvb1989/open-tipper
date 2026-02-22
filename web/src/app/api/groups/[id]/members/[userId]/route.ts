import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string; userId: string }> };

/**
 * DELETE /api/groups/:id/members/:userId
 *
 * Remove a member from a group. Admin only. Cannot remove yourself.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, userId } = await params;

    // Check that the requester is admin
    const adminMembership = await prisma.membership.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId: id } },
    });
    if (!adminMembership || adminMembership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cannot remove yourself
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot remove yourself. Use the leave endpoint instead." },
        { status: 400 },
      );
    }

    // Find the member to remove
    const targetMembership = await prisma.membership.findUnique({
      where: { userId_groupId: { userId, groupId: id } },
    });
    if (!targetMembership) {
      return NextResponse.json(
        { error: "User is not a member of this group" },
        { status: 404 },
      );
    }

    await prisma.membership.delete({
      where: { id: targetMembership.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 },
    );
  }
}

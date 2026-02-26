import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/groups/:id/leave
 *
 * Leave a group. Admins cannot leave (they must delete or transfer first).
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const membership = await prisma.membership.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId: id } },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this group" }, { status: 404 });
    }

    if (membership.role === "ADMIN") {
      return NextResponse.json(
        { error: "Admins cannot leave the group. Delete the group or transfer admin role first." },
        { status: 400 },
      );
    }

    await prisma.membership.delete({
      where: { id: membership.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to leave group:", error);
    return NextResponse.json({ error: "Failed to leave group" }, { status: 500 });
  }
}

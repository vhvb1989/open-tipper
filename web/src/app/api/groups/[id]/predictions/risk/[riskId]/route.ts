import { MatchStatus, RiskStatus } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAvailableBalance } from "@/lib/risk-balance";

type RouteParams = { params: Promise<{ id: string; riskId: string }> };

function canCancelRisk(match: { status: MatchStatus; kickoffTime: Date }) {
  return match.status === MatchStatus.SCHEDULED && match.kickoffTime > new Date();
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, riskId } = await params;

    const riskPrediction = await prisma.riskPrediction.findUnique({
      where: { id: riskId },
      include: {
        match: {
          select: {
            kickoffTime: true,
            status: true,
          },
        },
      },
    });

    if (!riskPrediction) {
      return NextResponse.json({ error: "Risk prediction not found" }, { status: 404 });
    }
    if (riskPrediction.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (riskPrediction.groupId !== id) {
      return NextResponse.json({ error: "Risk prediction not found" }, { status: 404 });
    }
    if (riskPrediction.status !== RiskStatus.PENDING) {
      return NextResponse.json(
        { error: "Only pending risk predictions can be cancelled" },
        { status: 400 },
      );
    }
    if (!canCancelRisk(riskPrediction.match)) {
      return NextResponse.json(
        { error: "Risk predictions cannot be cancelled after kick-off" },
        { status: 403 },
      );
    }

    await prisma.riskPrediction.update({
      where: { id: riskId },
      data: {
        status: RiskStatus.CANCELLED,
        resolvedAt: new Date(),
        pointsAwarded: null,
      },
    });
    const balance = await getAvailableBalance(session.user.id, id, prisma);

    return NextResponse.json({ success: true, balance });
  } catch (error) {
    console.error("Failed to cancel risk prediction:", error);
    return NextResponse.json({ error: "Failed to cancel risk prediction" }, { status: 500 });
  }
}

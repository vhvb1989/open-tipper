import { MatchStatus, PrismaClient, RiskCategory, RiskStatus } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAvailableBalance } from "@/lib/risk-balance";

type RouteParams = { params: Promise<{ id: string }> };

function isValidRiskCategory(category: unknown): category is RiskCategory {
  return (
    typeof category === "string" && Object.values(RiskCategory).includes(category as RiskCategory)
  );
}

function isUpcomingMatch(match: { status: MatchStatus; kickoffTime: Date }) {
  return match.status === MatchStatus.SCHEDULED && match.kickoffTime > new Date();
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
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
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    const riskPredictions = await prisma.riskPrediction.findMany({
      where: {
        userId: session.user.id,
        groupId: id,
      },
      orderBy: [{ matchId: "asc" }, { createdAt: "asc" }],
    });
    const balance = await getAvailableBalance(session.user.id, id, prisma);

    const byMatch: Record<string, typeof riskPredictions> = {};
    for (const riskPrediction of riskPredictions) {
      byMatch[riskPrediction.matchId] ??= [];
      byMatch[riskPrediction.matchId].push(riskPrediction);
    }

    return NextResponse.json({ risks: byMatch, balance });
  } catch (error) {
    console.error("Failed to fetch risk predictions:", error);
    return NextResponse.json({ error: "Failed to fetch risk predictions" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    const body = await request.json();
    const { matchId, category, predictedValue, pointsRisked } = body;

    if (!matchId || typeof matchId !== "string") {
      return NextResponse.json({ error: "Match ID is required" }, { status: 400 });
    }
    if (!isValidRiskCategory(category)) {
      return NextResponse.json({ error: "Invalid risk category" }, { status: 400 });
    }
    if (
      typeof predictedValue !== "number" ||
      !Number.isInteger(predictedValue) ||
      predictedValue < 0
    ) {
      return NextResponse.json(
        { error: "Predicted value must be a non-negative integer" },
        { status: 400 },
      );
    }
    if (typeof pointsRisked !== "number" || !Number.isInteger(pointsRisked) || pointsRisked < 1) {
      return NextResponse.json(
        { error: "Points risked must be a positive integer" },
        { status: 400 },
      );
    }

    const group = await prisma.group.findUnique({
      where: { id },
      select: { contestId: true, riskEnabled: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    if (!group.riskEnabled) {
      return NextResponse.json({ error: "Risk predictions not enabled" }, { status: 400 });
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, contestId: true, kickoffTime: true, status: true },
    });
    if (!match || match.contestId !== group.contestId) {
      return NextResponse.json(
        { error: "Match not found in this group's contest" },
        { status: 404 },
      );
    }
    if (!isUpcomingMatch(match)) {
      return NextResponse.json(
        { error: "Risk predictions are locked after kick-off" },
        { status: 403 },
      );
    }

    // Use a transaction to prevent race conditions on balance check
    const result = await prisma.$transaction(async (tx) => {
      const existingRisk = await tx.riskPrediction.findUnique({
        where: {
          userId_groupId_matchId_category: {
            userId: session.user.id,
            groupId: id,
            matchId,
            category,
          },
        },
      });
      if (existingRisk?.status === RiskStatus.PENDING) {
        return { error: "A pending risk prediction already exists for this category", status: 409 };
      }

      const availableBalance = await getAvailableBalance(session.user.id, id, tx as PrismaClient);
      if (availableBalance < pointsRisked) {
        return { error: "Insufficient available balance", status: 400 };
      }

      const riskPrediction = existingRisk
        ? await tx.riskPrediction.update({
            where: { id: existingRisk.id },
            data: {
              predictedValue,
              pointsRisked,
              status: RiskStatus.PENDING,
              pointsAwarded: null,
              resolvedAt: null,
            },
          })
        : await tx.riskPrediction.create({
            data: {
              userId: session.user.id,
              groupId: id,
              matchId,
              category,
              predictedValue,
              pointsRisked,
              status: RiskStatus.PENDING,
            },
          });

      return { riskPrediction, balance: availableBalance - pointsRisked };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to save risk prediction:", error);
    return NextResponse.json({ error: "Failed to save risk prediction" }, { status: 500 });
  }
}

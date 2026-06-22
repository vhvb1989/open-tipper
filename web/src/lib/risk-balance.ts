import { PrismaClient, RiskStatus } from "@/generated/prisma/client";

type RiskTotals = Record<RiskStatus, { pointsRisked: number; pointsAwarded: number }>;

function createEmptyRiskTotals(): RiskTotals {
  return {
    [RiskStatus.PENDING]: { pointsRisked: 0, pointsAwarded: 0 },
    [RiskStatus.WON]: { pointsRisked: 0, pointsAwarded: 0 },
    [RiskStatus.LOST]: { pointsRisked: 0, pointsAwarded: 0 },
    [RiskStatus.CANCELLED]: { pointsRisked: 0, pointsAwarded: 0 },
  };
}

async function getScoredPredictionPoints(
  userId: string,
  groupId: string,
  db: PrismaClient,
): Promise<number> {
  const result = await db.prediction.aggregate({
    where: {
      userId,
      groupId,
      pointsAwarded: { not: null },
    },
    _sum: {
      pointsAwarded: true,
      bonusPoints: true,
    },
  });

  return (result._sum.pointsAwarded ?? 0) + (result._sum.bonusPoints ?? 0);
}

async function getRiskTotals(
  userId: string,
  groupId: string,
  db: PrismaClient,
): Promise<RiskTotals> {
  const grouped = await db.riskPrediction.groupBy({
    by: ["status"],
    where: {
      userId,
      groupId,
      status: {
        in: [RiskStatus.PENDING, RiskStatus.WON, RiskStatus.LOST],
      },
    },
    _sum: {
      pointsRisked: true,
      pointsAwarded: true,
    },
  });

  const totals = createEmptyRiskTotals();

  for (const row of grouped) {
    totals[row.status] = {
      pointsRisked: row._sum.pointsRisked ?? 0,
      pointsAwarded: row._sum.pointsAwarded ?? 0,
    };
  }

  return totals;
}

export async function getAvailableBalance(
  userId: string,
  groupId: string,
  db: PrismaClient,
): Promise<number> {
  const [predictionPoints, riskTotals] = await Promise.all([
    getScoredPredictionPoints(userId, groupId, db),
    getRiskTotals(userId, groupId, db),
  ]);

  // Tiered payouts: stake is always deducted; winnings (stored pointsAwarded)
  // are added back for won risks. A refund tier stores pointsAwarded === stake.
  const balance =
    predictionPoints +
    riskTotals[RiskStatus.WON].pointsAwarded -
    riskTotals[RiskStatus.WON].pointsRisked -
    riskTotals[RiskStatus.PENDING].pointsRisked -
    riskTotals[RiskStatus.LOST].pointsRisked;

  return Math.max(0, balance);
}

export async function getDisplayBalance(
  userId: string,
  groupId: string,
  db: PrismaClient,
): Promise<number> {
  const [predictionPoints, riskTotals] = await Promise.all([
    getScoredPredictionPoints(userId, groupId, db),
    getRiskTotals(userId, groupId, db),
  ]);

  // Display balance: net gain from won risks (pointsAwarded - pointsRisked) minus lost stakes
  return (
    predictionPoints +
    riskTotals[RiskStatus.WON].pointsAwarded -
    riskTotals[RiskStatus.WON].pointsRisked -
    riskTotals[RiskStatus.LOST].pointsRisked
  );
}

export async function getRiskPointsSummary(
  userId: string,
  groupId: string,
  db: PrismaClient,
): Promise<{ netRiskPoints: number; totalPending: number }> {
  const riskTotals = await getRiskTotals(userId, groupId, db);

  // Net risk = winnings minus all stakes (won + lost)
  return {
    netRiskPoints:
      riskTotals[RiskStatus.WON].pointsAwarded -
      riskTotals[RiskStatus.WON].pointsRisked -
      riskTotals[RiskStatus.LOST].pointsRisked,
    totalPending: riskTotals[RiskStatus.PENDING].pointsRisked,
  };
}

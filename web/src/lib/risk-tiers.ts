/**
 * Risk payout configuration & scoring.
 *
 * Each category is balanced so that an exact (bullseye) guess is always the best
 * reward, while the long-run expected value for a skilled player sits near
 * break-even (a real risk, not a points faucet).
 *
 * Count categories (corners / yellow cards / offsides) compare the absolute
 * difference between the predicted and actual combined total. The first matching
 * tier (smallest `maxDiff`) wins. A multiplier of 1 is a refund (net 0); no
 * matching tier means the stake is lost.
 *
 * Red cards is a binary over/under-0.5 market: predict 0 ("no red card") or
 * >= 1 ("red card!"). It cannot be balanced as an exact count because ~74% of
 * matches have zero red cards.
 */

import { RiskStatus } from "@/generated/prisma/client";
import type { RiskCategory } from "@/generated/prisma/client";

export interface RiskTier {
  /** Inclusive max absolute difference from the actual value for this tier. */
  maxDiff: number;
  /** Gross payout multiplier on the stake (1 = refund, 0 would be a loss). */
  multiplier: number;
}

/**
 * Tiered payouts for count-based categories, ordered from most precise to least.
 */
export const COUNT_TIERS: Partial<Record<RiskCategory, RiskTier[]>> = {
  CORNER_KICKS: [
    { maxDiff: 0, multiplier: 3 },
    { maxDiff: 1, multiplier: 2 },
    { maxDiff: 2, multiplier: 1 },
  ],
  YELLOW_CARDS: [
    { maxDiff: 0, multiplier: 3 },
    { maxDiff: 1, multiplier: 1 },
  ],
  OFFSIDES: [
    { maxDiff: 0, multiplier: 3 },
    { maxDiff: 1, multiplier: 1 },
  ],
};

/**
 * Binary red-card payouts. `predictedValue` is stored as 0 ("no red card") or
 * >= 1 ("red card!").
 */
export const RED_CARD_MULTIPLIERS = {
  /** Safe call: no red card. */
  no: 1.3,
  /** Brave call: at least one red card. */
  yes: 3,
} as const;

export interface RiskScore {
  status: RiskStatus;
  pointsAwarded: number;
}

/**
 * Resolve a single risk prediction against the actual match value.
 *
 * @param category       The stat category being predicted.
 * @param predictedValue The user's predicted value (0/>=1 for red cards).
 * @param actualValue    The actual combined total from match stats.
 * @param pointsRisked   The stake.
 */
export function scoreRisk(
  category: RiskCategory,
  predictedValue: number,
  actualValue: number,
  pointsRisked: number,
): RiskScore {
  if (String(category) === "RED_CARDS") {
    const predictedRed = predictedValue >= 1;
    const actualRed = actualValue >= 1;
    if (predictedRed === actualRed) {
      const multiplier = predictedRed ? RED_CARD_MULTIPLIERS.yes : RED_CARD_MULTIPLIERS.no;
      return { status: RiskStatus.WON, pointsAwarded: Math.round(pointsRisked * multiplier) };
    }
    return { status: RiskStatus.LOST, pointsAwarded: 0 };
  }

  const tiers = COUNT_TIERS[category];
  if (tiers) {
    const diff = Math.abs(predictedValue - actualValue);
    const tier = tiers.find((t) => diff <= t.maxDiff);
    if (tier) {
      return { status: RiskStatus.WON, pointsAwarded: Math.round(pointsRisked * tier.multiplier) };
    }
  }

  return { status: RiskStatus.LOST, pointsAwarded: 0 };
}

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

export interface RiskScore {
  status: RiskStatus;
  pointsAwarded: number;
}

/**
 * Resolve a single risk prediction against the actual match value.
 *
 * @param category       The stat category being predicted.
 * @param predictedValue The user's predicted value.
 * @param actualValue    The actual combined total from match stats.
 * @param pointsRisked   The stake.
 */
export function scoreRisk(
  category: RiskCategory,
  predictedValue: number,
  actualValue: number,
  pointsRisked: number,
): RiskScore {
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

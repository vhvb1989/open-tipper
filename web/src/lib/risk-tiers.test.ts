import { describe, it, expect } from "vitest";
import { RiskCategory, RiskStatus } from "@/generated/prisma/client";
import { scoreRisk } from "./risk-tiers";

describe("scoreRisk — count categories", () => {
  describe("CORNER_KICKS (3× / 2× / 1× refund)", () => {
    const actual = 11;
    const stake = 100;

    it("pays 3× for an exact guess", () => {
      expect(scoreRisk(RiskCategory.CORNER_KICKS, 11, actual, stake)).toEqual({
        status: RiskStatus.WON,
        pointsAwarded: 300,
      });
    });

    it("pays 2× when off by 1 (either side)", () => {
      expect(scoreRisk(RiskCategory.CORNER_KICKS, 10, actual, stake).pointsAwarded).toBe(200);
      expect(scoreRisk(RiskCategory.CORNER_KICKS, 12, actual, stake).pointsAwarded).toBe(200);
    });

    it("refunds the stake (1×) when off by 2", () => {
      expect(scoreRisk(RiskCategory.CORNER_KICKS, 9, actual, stake)).toEqual({
        status: RiskStatus.WON,
        pointsAwarded: 100,
      });
      expect(scoreRisk(RiskCategory.CORNER_KICKS, 13, actual, stake).pointsAwarded).toBe(100);
    });

    it("loses when off by 3 or more", () => {
      expect(scoreRisk(RiskCategory.CORNER_KICKS, 8, actual, stake)).toEqual({
        status: RiskStatus.LOST,
        pointsAwarded: 0,
      });
    });
  });

  describe.each([RiskCategory.YELLOW_CARDS, RiskCategory.OFFSIDES])(
    "%s (3× / 1× refund)",
    (category) => {
      const actual = 4;
      const stake = 10;

      it("pays 3× for an exact guess", () => {
        expect(scoreRisk(category, 4, actual, stake)).toEqual({
          status: RiskStatus.WON,
          pointsAwarded: 30,
        });
      });

      it("refunds the stake (1×) when off by 1", () => {
        expect(scoreRisk(category, 3, actual, stake).pointsAwarded).toBe(10);
        expect(scoreRisk(category, 5, actual, stake).pointsAwarded).toBe(10);
      });

      it("loses when off by 2 or more", () => {
        expect(scoreRisk(category, 6, actual, stake)).toEqual({
          status: RiskStatus.LOST,
          pointsAwarded: 0,
        });
      });
    },
  );
});

describe("scoreRisk — RED_CARDS (binary over/under 0.5)", () => {
  const stake = 10;

  it("pays 3× for a correct 'red card!' call", () => {
    expect(scoreRisk(RiskCategory.RED_CARDS, 1, 2, stake)).toEqual({
      status: RiskStatus.WON,
      pointsAwarded: 30,
    });
  });

  it("pays 1.3× (rounded) for a correct 'no card' call", () => {
    expect(scoreRisk(RiskCategory.RED_CARDS, 0, 0, stake)).toEqual({
      status: RiskStatus.WON,
      pointsAwarded: 13,
    });
  });

  it("rounds the 1.3× payout to the nearest integer", () => {
    // 5 * 1.3 = 6.5 → 7
    expect(scoreRisk(RiskCategory.RED_CARDS, 0, 0, 5).pointsAwarded).toBe(7);
  });

  it("loses when predicting 'no card' but a card is shown", () => {
    expect(scoreRisk(RiskCategory.RED_CARDS, 0, 1, stake)).toEqual({
      status: RiskStatus.LOST,
      pointsAwarded: 0,
    });
  });

  it("loses when predicting 'red card!' but none is shown", () => {
    expect(scoreRisk(RiskCategory.RED_CARDS, 1, 0, stake)).toEqual({
      status: RiskStatus.LOST,
      pointsAwarded: 0,
    });
  });
});

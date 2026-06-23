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

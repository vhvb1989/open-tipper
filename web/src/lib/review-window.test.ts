/**
 * Post-match review window — unit tests for the settling algorithm.
 */
import { describe, it, expect } from "vitest";
import {
  advanceReview,
  statsChanged,
  REVIEW_MAX_POLLS,
  REVIEW_STABLE_REQUIRED,
} from "./review-window";

const baseStats = { yellowCards: 2, redCards: 0, cornerKicks: 9, offsides: 3 };

describe("statsChanged", () => {
  it("reports a change when there is no stored record yet", () => {
    expect(statsChanged(null, baseStats)).toBe(true);
    expect(statsChanged(undefined, baseStats)).toBe(true);
  });

  it("reports no change when all four totals match", () => {
    expect(statsChanged({ ...baseStats }, { ...baseStats })).toBe(false);
  });

  it("detects a late yellow card (2 → 3)", () => {
    expect(statsChanged({ ...baseStats, yellowCards: 2 }, { ...baseStats, yellowCards: 3 })).toBe(
      true,
    );
  });

  it("treats a null stored field as different from a numeric fresh value", () => {
    expect(statsChanged({ ...baseStats, offsides: null }, { ...baseStats, offsides: 0 })).toBe(
      true,
    );
  });
});

describe("advanceReview", () => {
  it("completes after one stable poll (stats unchanged)", () => {
    const result = advanceReview({ reviewPollCount: 0, reviewStableCount: 0 }, false);
    expect(result.reviewPollCount).toBe(1);
    expect(result.reviewStableCount).toBe(REVIEW_STABLE_REQUIRED);
    expect(result.complete).toBe(true);
  });

  it("does not complete on a poll where stats changed (resets stability)", () => {
    const result = advanceReview({ reviewPollCount: 0, reviewStableCount: 0 }, true);
    expect(result.reviewPollCount).toBe(1);
    expect(result.reviewStableCount).toBe(0);
    expect(result.complete).toBe(false);
  });

  it("completes at the hard poll cap even if stats keep changing", () => {
    // Simulate a match whose stats never settle: change on every poll.
    let counters = { reviewPollCount: 0, reviewStableCount: 0 };
    const completions: boolean[] = [];
    for (let i = 0; i < REVIEW_MAX_POLLS; i++) {
      const r = advanceReview(counters, true);
      counters = { reviewPollCount: r.reviewPollCount, reviewStableCount: r.reviewStableCount };
      completions.push(r.complete);
    }
    // Not complete until the cap is hit on the final poll.
    expect(completions.slice(0, REVIEW_MAX_POLLS - 1).every((c) => c === false)).toBe(true);
    expect(completions[REVIEW_MAX_POLLS - 1]).toBe(true);
    expect(counters.reviewPollCount).toBe(REVIEW_MAX_POLLS);
  });

  it("holds a stale match open one extra poll, then resolves once it stabilizes", () => {
    // Poll 1: provisional stats corrected (changed) → keep reviewing.
    const p1 = advanceReview({ reviewPollCount: 0, reviewStableCount: 0 }, true);
    expect(p1.complete).toBe(false);
    // Poll 2: corrected stats hold steady (unchanged) → settle.
    const p2 = advanceReview(
      { reviewPollCount: p1.reviewPollCount, reviewStableCount: p1.reviewStableCount },
      false,
    );
    expect(p2.complete).toBe(true);
  });
});

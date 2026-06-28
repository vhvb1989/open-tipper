/**
 * Post-match review window — unit tests for the settling algorithm.
 */
import { describe, it, expect } from "vitest";
import {
  advanceReview,
  statsChanged,
  REVIEW_MAX_POLLS,
  REVIEW_STABLE_REQUIRED,
  MIN_REVIEW_WAIT_MS,
  REVIEW_MAX_WAIT_MS,
} from "./review-window";

const baseStats = { yellowCards: 2, redCards: 0, cornerKicks: 9, offsides: 3 };

const BEFORE_MIN = MIN_REVIEW_WAIT_MS - 60 * 1000; // just under the minimum wait
const AFTER_MIN = MIN_REVIEW_WAIT_MS + 60 * 1000; // just past the minimum wait
const AFTER_CAP = REVIEW_MAX_WAIT_MS + 60 * 1000; // past the hard cap

describe("statsChanged", () => {
  it("reports a change when there is no stored record yet", () => {
    expect(statsChanged(null, baseStats)).toBe(true);
    expect(statsChanged(undefined, baseStats)).toBe(true);
  });

  it("reports no change when all four totals match", () => {
    expect(statsChanged({ ...baseStats }, { ...baseStats })).toBe(false);
  });

  it("detects a late offside (0 → 1)", () => {
    expect(statsChanged({ ...baseStats, offsides: 0 }, { ...baseStats, offsides: 1 })).toBe(true);
  });

  it("treats a null stored field as different from a numeric fresh value", () => {
    expect(statsChanged({ ...baseStats, offsides: null }, { ...baseStats, offsides: 0 })).toBe(
      true,
    );
  });
});

describe("advanceReview — minimum wait gate", () => {
  it("does NOT complete while stats are stable but the minimum wait has not elapsed", () => {
    // Stable for the required number of polls, but only a few minutes after FT.
    const result = advanceReview({
      reviewPollCount: REVIEW_STABLE_REQUIRED,
      reviewStableCount: REVIEW_STABLE_REQUIRED - 1,
      changed: false,
      msSinceFinished: BEFORE_MIN,
    });
    expect(result.reviewStableCount).toBe(REVIEW_STABLE_REQUIRED);
    expect(result.complete).toBe(false);
  });

  it("completes once the minimum wait has elapsed AND stats are stable", () => {
    const result = advanceReview({
      reviewPollCount: REVIEW_STABLE_REQUIRED,
      reviewStableCount: REVIEW_STABLE_REQUIRED - 1,
      changed: false,
      msSinceFinished: AFTER_MIN,
    });
    expect(result.complete).toBe(true);
  });

  it("does not complete past the minimum wait if stats are not yet stable", () => {
    const result = advanceReview({
      reviewPollCount: 5,
      reviewStableCount: 0,
      changed: true,
      msSinceFinished: AFTER_MIN,
    });
    expect(result.reviewStableCount).toBe(0);
    expect(result.complete).toBe(false);
  });
});

describe("advanceReview — hard cap", () => {
  it("completes at the time cap even if stats never stabilize", () => {
    const result = advanceReview({
      reviewPollCount: 99,
      reviewStableCount: 0,
      changed: true,
      msSinceFinished: AFTER_CAP,
    });
    expect(result.complete).toBe(true);
  });

  it("falls back to the poll-count cap when FT time is unknown", () => {
    const result = advanceReview({
      reviewPollCount: REVIEW_MAX_POLLS - 1,
      reviewStableCount: 0,
      changed: true,
      msSinceFinished: null,
    });
    expect(result.reviewPollCount).toBe(REVIEW_MAX_POLLS);
    expect(result.complete).toBe(true);
  });

  it("with unknown FT time, completes on stability (no wall-clock gate)", () => {
    const result = advanceReview({
      reviewPollCount: REVIEW_STABLE_REQUIRED,
      reviewStableCount: REVIEW_STABLE_REQUIRED - 1,
      changed: false,
      msSinceFinished: null,
    });
    expect(result.complete).toBe(true);
  });
});

describe("advanceReview — late-correction scenario", () => {
  it("holds the window open when a late offside lands, then resolves on the corrected value", () => {
    // Poll near the minimum wait: provider finally ingests the late offside → changed.
    const p1 = advanceReview({
      reviewPollCount: 4,
      reviewStableCount: 1,
      changed: true,
      msSinceFinished: AFTER_MIN,
    });
    expect(p1.reviewStableCount).toBe(0);
    expect(p1.complete).toBe(false);

    // Subsequent polls hold steady on the corrected value until stable again.
    let counters = { reviewPollCount: p1.reviewPollCount, reviewStableCount: p1.reviewStableCount };
    let last = p1;
    for (let i = 0; i < REVIEW_STABLE_REQUIRED; i++) {
      last = advanceReview({
        reviewPollCount: counters.reviewPollCount,
        reviewStableCount: counters.reviewStableCount,
        changed: false,
        msSinceFinished: AFTER_MIN,
      });
      counters = {
        reviewPollCount: last.reviewPollCount,
        reviewStableCount: last.reviewStableCount,
      };
    }
    expect(last.complete).toBe(true);
  });
});

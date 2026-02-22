/**
 * Scoring Engine — Unit Tests
 *
 * Tests all 6 scoring factors, accumulation modes, playoff multiplier,
 * and the spec examples from §5.3.
 */
import { describe, it, expect } from "vitest";
import {
  calculateScore,
  matchesExactScore,
  matchesGoalDifference,
  matchesOutcome,
  matchesOneTeamGoals,
  matchesTotalGoals,
  matchesReverseGoalDifference,
  isPlayoffStage,
  DEFAULT_SCORING_RULES,
  type ScoringRulesConfig,
  type Prediction,
  type MatchResult,
} from "./scoring";

// ---------------------------------------------------------------------------
// Individual Factor Tests
// ---------------------------------------------------------------------------

describe("Factor 1: Exact Scoreline", () => {
  it("matches when prediction equals result", () => {
    expect(matchesExactScore({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 })).toBe(true);
  });

  it("matches 0-0 draws", () => {
    expect(matchesExactScore({ homeGoals: 0, awayGoals: 0 }, { homeGoals: 0, awayGoals: 0 })).toBe(true);
  });

  it("does not match when different", () => {
    expect(matchesExactScore({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 3, awayGoals: 1 })).toBe(false);
  });

  it("does not match when reversed", () => {
    expect(matchesExactScore({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 1, awayGoals: 2 })).toBe(false);
  });
});

describe("Factor 2: Goal Difference", () => {
  it("matches same goal difference", () => {
    expect(matchesGoalDifference({ homeGoals: 3, awayGoals: 1 }, { homeGoals: 2, awayGoals: 0 })).toBe(true); // both +2
  });

  it("matches draw with draw (diff = 0)", () => {
    expect(matchesGoalDifference({ homeGoals: 1, awayGoals: 1 }, { homeGoals: 2, awayGoals: 2 })).toBe(true);
  });

  it("does not match different diffs", () => {
    expect(matchesGoalDifference({ homeGoals: 3, awayGoals: 0 }, { homeGoals: 2, awayGoals: 0 })).toBe(false); // +3 vs +2
  });

  it("does not match reverse", () => {
    expect(matchesGoalDifference({ homeGoals: 3, awayGoals: 1 }, { homeGoals: 1, awayGoals: 3 })).toBe(false); // +2 vs -2
  });
});

describe("Factor 3: Outcome", () => {
  it("matches home win", () => {
    expect(matchesOutcome({ homeGoals: 3, awayGoals: 0 }, { homeGoals: 1, awayGoals: 0 })).toBe(true);
  });

  it("matches draw", () => {
    expect(matchesOutcome({ homeGoals: 0, awayGoals: 0 }, { homeGoals: 3, awayGoals: 3 })).toBe(true);
  });

  it("matches away win", () => {
    expect(matchesOutcome({ homeGoals: 0, awayGoals: 1 }, { homeGoals: 0, awayGoals: 2 })).toBe(true);
  });

  it("does not match wrong outcome", () => {
    expect(matchesOutcome({ homeGoals: 2, awayGoals: 0 }, { homeGoals: 0, awayGoals: 1 })).toBe(false);
  });
});

describe("Factor 4: One Team's Goals", () => {
  it("matches home team goals", () => {
    expect(matchesOneTeamGoals({ homeGoals: 2, awayGoals: 0 }, { homeGoals: 2, awayGoals: 3 })).toBe(true);
  });

  it("matches away team goals", () => {
    expect(matchesOneTeamGoals({ homeGoals: 0, awayGoals: 2 }, { homeGoals: 3, awayGoals: 2 })).toBe(true);
  });

  it("matches both teams", () => {
    expect(matchesOneTeamGoals({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 })).toBe(true);
  });

  it("does not match when neither team is correct", () => {
    expect(matchesOneTeamGoals({ homeGoals: 2, awayGoals: 0 }, { homeGoals: 1, awayGoals: 3 })).toBe(false);
  });
});

describe("Factor 5: Total Goals", () => {
  it("matches same total", () => {
    expect(matchesTotalGoals({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 0, awayGoals: 3 })).toBe(true); // 3 = 3
  });

  it("matches 0-0", () => {
    expect(matchesTotalGoals({ homeGoals: 0, awayGoals: 0 }, { homeGoals: 0, awayGoals: 0 })).toBe(true);
  });

  it("does not match different totals", () => {
    expect(matchesTotalGoals({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 2 })).toBe(false); // 3 ≠ 4
  });
});

describe("Factor 6: Reverse Goal Difference", () => {
  it("matches reverse goal diff", () => {
    expect(matchesReverseGoalDifference({ homeGoals: 3, awayGoals: 1 }, { homeGoals: 1, awayGoals: 3 })).toBe(true); // +2 vs -2
  });

  it("matches with different magnitudes than 2", () => {
    expect(matchesReverseGoalDifference({ homeGoals: 3, awayGoals: 0 }, { homeGoals: 0, awayGoals: 3 })).toBe(true); // +3 vs -3
  });

  it("does not apply to draws (pred is draw)", () => {
    expect(matchesReverseGoalDifference({ homeGoals: 1, awayGoals: 1 }, { homeGoals: 2, awayGoals: 2 })).toBe(false);
  });

  it("does not apply to draws (result is draw)", () => {
    expect(matchesReverseGoalDifference({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 1, awayGoals: 1 })).toBe(false);
  });

  it("does not match when magnitudes differ", () => {
    expect(matchesReverseGoalDifference({ homeGoals: 3, awayGoals: 1 }, { homeGoals: 0, awayGoals: 3 })).toBe(false); // +2 vs -3
  });

  it("does not match when same sign", () => {
    expect(matchesReverseGoalDifference({ homeGoals: 2, awayGoals: 0 }, { homeGoals: 3, awayGoals: 1 })).toBe(false); // +2 vs +2 (same)
  });
});

// ---------------------------------------------------------------------------
// SPEC §5.3 Examples — Accumulate Mode, Default Points
// ---------------------------------------------------------------------------

describe("SPEC §5.3 Scoring Examples (Accumulate, Default Points)", () => {
  const rules = DEFAULT_SCORING_RULES;

  it("2-1 predicted, 2-1 actual → 25 pts (Exact + Diff + Outcome + OneTeam + Total)", () => {
    const score = calculateScore({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, rules);
    expect(score.exactScore).toBe(10);
    expect(score.goalDifference).toBe(6);
    expect(score.outcome).toBe(4);
    expect(score.oneTeamGoals).toBe(3);
    expect(score.totalGoals).toBe(2);
    expect(score.reverseGoalDifference).toBe(0);
    expect(score.total).toBe(25);
  });

  it("3-1 predicted, 2-0 actual → 10 pts (Diff + Outcome)", () => {
    const score = calculateScore({ homeGoals: 3, awayGoals: 1 }, { homeGoals: 2, awayGoals: 0 }, rules);
    expect(score.exactScore).toBe(0);
    expect(score.goalDifference).toBe(6);
    expect(score.outcome).toBe(4);
    expect(score.oneTeamGoals).toBe(0);
    expect(score.totalGoals).toBe(0);
    expect(score.reverseGoalDifference).toBe(0);
    expect(score.total).toBe(10);
  });

  it("0-1 predicted, 0-2 actual → 7 pts (Outcome + OneTeam)", () => {
    const score = calculateScore({ homeGoals: 0, awayGoals: 1 }, { homeGoals: 0, awayGoals: 2 }, rules);
    expect(score.exactScore).toBe(0);
    expect(score.goalDifference).toBe(0);
    expect(score.outcome).toBe(4);
    expect(score.oneTeamGoals).toBe(3);
    expect(score.totalGoals).toBe(0);
    expect(score.reverseGoalDifference).toBe(0);
    expect(score.total).toBe(7);
  });

  it("1-1 predicted, 2-2 actual → 12 pts (Diff + Outcome + Total)", () => {
    const score = calculateScore({ homeGoals: 1, awayGoals: 1 }, { homeGoals: 2, awayGoals: 2 }, rules);
    expect(score.exactScore).toBe(0);
    expect(score.goalDifference).toBe(6);
    expect(score.outcome).toBe(4);
    expect(score.oneTeamGoals).toBe(0);
    expect(score.totalGoals).toBe(0);
    expect(score.reverseGoalDifference).toBe(0);
    expect(score.total).toBe(10);
  });

  it("3-4 predicted, 1-2 actual → 10 pts (Diff + Outcome)", () => {
    // Both have diff=-1, both away wins
    const score = calculateScore({ homeGoals: 3, awayGoals: 4 }, { homeGoals: 1, awayGoals: 2 }, rules);
    expect(score.exactScore).toBe(0);
    expect(score.goalDifference).toBe(6);
    expect(score.outcome).toBe(4);
    expect(score.oneTeamGoals).toBe(0);
    expect(score.totalGoals).toBe(0);
    expect(score.reverseGoalDifference).toBe(0);
    expect(score.total).toBe(10);
  });

  it("2-0 predicted, 1-3 actual → 1 pt (reverse goal diff only)", () => {
    // +2 vs -2: wrong outcome, wrong everything except reverse goal diff
    const score = calculateScore({ homeGoals: 2, awayGoals: 0 }, { homeGoals: 1, awayGoals: 3 }, rules);
    expect(score.exactScore).toBe(0);
    expect(score.goalDifference).toBe(0);
    expect(score.outcome).toBe(0);
    expect(score.oneTeamGoals).toBe(0);
    expect(score.totalGoals).toBe(0);
    expect(score.reverseGoalDifference).toBe(1);
    expect(score.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Accumulation Mode: Highest Only
// ---------------------------------------------------------------------------

describe("Highest Only Mode", () => {
  const rules: ScoringRulesConfig = {
    ...DEFAULT_SCORING_RULES,
    accumulationMode: "HIGHEST_ONLY",
  };

  it("exact score hit → only 10 pts (highest factor)", () => {
    const score = calculateScore({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, rules);
    expect(score.total).toBe(10);
  });

  it("diff + outcome → only 6 pts (goal diff is highest)", () => {
    const score = calculateScore({ homeGoals: 3, awayGoals: 1 }, { homeGoals: 2, awayGoals: 0 }, rules);
    expect(score.total).toBe(6);
  });

  it("outcome only → 4 pts", () => {
    const score = calculateScore({ homeGoals: 0, awayGoals: 1 }, { homeGoals: 0, awayGoals: 2 }, rules);
    // Outcome (4) + OneTeam (3) → highest = 4
    expect(score.total).toBe(4);
  });

  it("reverse diff only → 1 pt (highest factor is reverse diff)", () => {
    // 2-0 vs 1-3: +2 vs -2 → reverse goal diff (1pt)
    const score = calculateScore({ homeGoals: 2, awayGoals: 0 }, { homeGoals: 1, awayGoals: 3 }, rules);
    expect(score.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Playoff Multiplier
// ---------------------------------------------------------------------------

describe("Playoff Multiplier", () => {
  const rules: ScoringRulesConfig = {
    ...DEFAULT_SCORING_RULES,
    playoffMultiplier: true,
  };

  it("doubles all points when isPlayoff=true and multiplier enabled", () => {
    const score = calculateScore(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 2, awayGoals: 1 },
      rules,
      true, // isPlayoff
    );
    expect(score.exactScore).toBe(20);
    expect(score.goalDifference).toBe(12);
    expect(score.outcome).toBe(8);
    expect(score.oneTeamGoals).toBe(6);
    expect(score.totalGoals).toBe(4);
    expect(score.total).toBe(50); // 25 * 2
  });

  it("no doubling when isPlayoff=false even with multiplier enabled", () => {
    const score = calculateScore(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 2, awayGoals: 1 },
      rules,
      false,
    );
    expect(score.total).toBe(25);
  });

  it("no doubling when multiplier disabled", () => {
    const noMultiplier: ScoringRulesConfig = {
      ...DEFAULT_SCORING_RULES,
      playoffMultiplier: false,
    };
    const score = calculateScore(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 2, awayGoals: 1 },
      noMultiplier,
      true,
    );
    expect(score.total).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// Custom Scoring Rules
// ---------------------------------------------------------------------------

describe("Custom Scoring Rules", () => {
  it("uses custom point values", () => {
    const rules: ScoringRulesConfig = {
      exactScore: 20,
      goalDifference: 12,
      outcome: 5,
      oneTeamGoals: 4,
      totalGoals: 3,
      reverseGoalDifference: 2,
      accumulationMode: "ACCUMULATE",
      playoffMultiplier: false,
    };
    const score = calculateScore({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, rules);
    expect(score.total).toBe(20 + 12 + 5 + 4 + 3); // 44
  });

  it("zero-point factors are ignored", () => {
    const rules: ScoringRulesConfig = {
      exactScore: 10,
      goalDifference: 0,
      outcome: 0,
      oneTeamGoals: 0,
      totalGoals: 0,
      reverseGoalDifference: 0,
      accumulationMode: "ACCUMULATE",
      playoffMultiplier: false,
    };
    const score = calculateScore({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, rules);
    expect(score.total).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Playoff Stage Detection
// ---------------------------------------------------------------------------

describe("isPlayoffStage", () => {
  it("detects QUARTER_FINALS as playoff", () => {
    expect(isPlayoffStage("QUARTER_FINALS")).toBe(true);
  });

  it("detects SEMI_FINALS as playoff", () => {
    expect(isPlayoffStage("SEMI_FINALS")).toBe(true);
  });

  it("detects FINAL as playoff", () => {
    expect(isPlayoffStage("FINAL")).toBe(true);
  });

  it("detects LAST_16 as playoff", () => {
    expect(isPlayoffStage("LAST_16")).toBe(true);
  });

  it("does not detect GROUP_STAGE as playoff", () => {
    expect(isPlayoffStage("GROUP_STAGE")).toBe(false);
  });

  it("does not detect LEAGUE_STAGE as playoff", () => {
    expect(isPlayoffStage("LEAGUE_STAGE")).toBe(false);
  });

  it("handles null", () => {
    expect(isPlayoffStage(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe("Edge Cases", () => {
  it("handles high-scoring matches", () => {
    const score = calculateScore(
      { homeGoals: 7, awayGoals: 5 },
      { homeGoals: 7, awayGoals: 5 },
      DEFAULT_SCORING_RULES,
    );
    expect(score.total).toBe(25);
  });

  it("handles 0-0 draw prediction and result", () => {
    const score = calculateScore(
      { homeGoals: 0, awayGoals: 0 },
      { homeGoals: 0, awayGoals: 0 },
      DEFAULT_SCORING_RULES,
    );
    expect(score.exactScore).toBe(10);
    expect(score.goalDifference).toBe(6);
    expect(score.outcome).toBe(4);
    expect(score.oneTeamGoals).toBe(3);
    expect(score.totalGoals).toBe(2);
    expect(score.reverseGoalDifference).toBe(0); // not applicable for draws
    expect(score.total).toBe(25);
  });

  it("reverse goal diff for away win predicted as home win with same margin", () => {
    // Predicted 2-0 (home +2), result 0-2 (away +2) → reverse match
    const score = calculateScore(
      { homeGoals: 2, awayGoals: 0 },
      { homeGoals: 0, awayGoals: 2 },
      DEFAULT_SCORING_RULES,
    );
    expect(score.reverseGoalDifference).toBe(1);
    expect(score.totalGoals).toBe(2); // both total 2
    expect(score.outcome).toBe(0); // wrong outcome
    expect(score.total).toBe(3); // reverseGD(1) + totalGoals(2)
  });
});

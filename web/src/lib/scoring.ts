/**
 * Scoring Engine
 *
 * Pure functions to calculate prediction points based on configurable
 * scoring rules. See SPEC.md §5 for the full scoring system description.
 *
 * Scoring Factors:
 *   1. Exact scoreline — predicted the exact final score
 *   2. Goal difference  — predicted the correct goal difference
 *   3. Outcome          — predicted the correct match result (home/draw/away)
 *   4. One team's goals — correctly predicted at least one team's exact goals
 *   5. Total goals      — correctly predicted the total goals in the match
 *   6. Reverse goal diff — predicted the right magnitude but wrong sign (not for draws)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoringRulesConfig {
  exactScore: number;
  goalDifference: number;
  outcome: number;
  oneTeamGoals: number;
  totalGoals: number;
  reverseGoalDifference: number;
  accumulationMode: "ACCUMULATE" | "HIGHEST_ONLY";
  playoffMultiplier: boolean;
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
}

export interface Prediction {
  homeGoals: number;
  awayGoals: number;
}

export interface ScoringBreakdown {
  exactScore: number;
  goalDifference: number;
  outcome: number;
  oneTeamGoals: number;
  totalGoals: number;
  reverseGoalDifference: number;
  total: number;
}

/** Default scoring rules matching SPEC.md §5 defaults */
export const DEFAULT_SCORING_RULES: ScoringRulesConfig = {
  exactScore: 10,
  goalDifference: 6,
  outcome: 4,
  oneTeamGoals: 3,
  totalGoals: 2,
  reverseGoalDifference: 1,
  accumulationMode: "ACCUMULATE",
  playoffMultiplier: false,
};

// ---------------------------------------------------------------------------
// Factor evaluation (pure functions)
// ---------------------------------------------------------------------------

/** Factor 1: Exact scoreline match */
export function matchesExactScore(pred: Prediction, result: MatchResult): boolean {
  return pred.homeGoals === result.homeGoals && pred.awayGoals === result.awayGoals;
}

/** Factor 2: Goal difference match */
export function matchesGoalDifference(pred: Prediction, result: MatchResult): boolean {
  return pred.homeGoals - pred.awayGoals === result.homeGoals - result.awayGoals;
}

/** Factor 3: Outcome match (home win / draw / away win) */
export function matchesOutcome(pred: Prediction, result: MatchResult): boolean {
  const predOutcome = Math.sign(pred.homeGoals - pred.awayGoals);
  const resultOutcome = Math.sign(result.homeGoals - result.awayGoals);
  return predOutcome === resultOutcome;
}

/** Factor 4: At least one team's goals correctly predicted */
export function matchesOneTeamGoals(pred: Prediction, result: MatchResult): boolean {
  return pred.homeGoals === result.homeGoals || pred.awayGoals === result.awayGoals;
}

/** Factor 5: Total goals match */
export function matchesTotalGoals(pred: Prediction, result: MatchResult): boolean {
  return pred.homeGoals + pred.awayGoals === result.homeGoals + result.awayGoals;
}

/**
 * Factor 6: Reverse goal difference — predicted the correct magnitude of
 * goal diff but with opposite sign. Does NOT apply to draws.
 */
export function matchesReverseGoalDifference(pred: Prediction, result: MatchResult): boolean {
  const predDiff = pred.homeGoals - pred.awayGoals;
  const resultDiff = result.homeGoals - result.awayGoals;

  // Does not apply if either prediction or result is a draw
  if (predDiff === 0 || resultDiff === 0) return false;

  // Same sign means it's a regular goal diff match (or exact), not reverse
  if (Math.sign(predDiff) === Math.sign(resultDiff)) return false;

  // Check magnitude
  return Math.abs(predDiff) === Math.abs(resultDiff);
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Calculate the points breakdown for a prediction against an actual result.
 *
 * @param pred - The user's predicted score
 * @param result - The actual match result
 * @param rules - The group's scoring rules
 * @param isPlayoff - Whether this match is a knockout/playoff match
 * @returns Full scoring breakdown with individual factor points and total
 */
export function calculateScore(
  pred: Prediction,
  result: MatchResult,
  rules: ScoringRulesConfig = DEFAULT_SCORING_RULES,
  isPlayoff: boolean = false,
): ScoringBreakdown {
  // Evaluate each factor
  const factors: ScoringBreakdown = {
    exactScore: matchesExactScore(pred, result) ? rules.exactScore : 0,
    goalDifference: matchesGoalDifference(pred, result) ? rules.goalDifference : 0,
    outcome: matchesOutcome(pred, result) ? rules.outcome : 0,
    oneTeamGoals: matchesOneTeamGoals(pred, result) ? rules.oneTeamGoals : 0,
    totalGoals: matchesTotalGoals(pred, result) ? rules.totalGoals : 0,
    reverseGoalDifference: matchesReverseGoalDifference(pred, result)
      ? rules.reverseGoalDifference
      : 0,
    total: 0,
  };

  // Calculate total based on accumulation mode
  if (rules.accumulationMode === "ACCUMULATE") {
    factors.total =
      factors.exactScore +
      factors.goalDifference +
      factors.outcome +
      factors.oneTeamGoals +
      factors.totalGoals +
      factors.reverseGoalDifference;
  } else {
    // HIGHEST_ONLY — take the single highest matching factor
    factors.total = Math.max(
      factors.exactScore,
      factors.goalDifference,
      factors.outcome,
      factors.oneTeamGoals,
      factors.totalGoals,
      factors.reverseGoalDifference,
    );
  }

  // Apply playoff multiplier
  if (isPlayoff && rules.playoffMultiplier) {
    factors.exactScore *= 2;
    factors.goalDifference *= 2;
    factors.outcome *= 2;
    factors.oneTeamGoals *= 2;
    factors.totalGoals *= 2;
    factors.reverseGoalDifference *= 2;
    factors.total *= 2;
  }

  return factors;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Known knockout/playoff stage identifiers from API-Football */
const PLAYOFF_STAGES = new Set([
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "FINAL",
  "ROUND_OF_16",
  "KNOCKOUT_ROUND_PLAYOFF",
  "THIRD_PLACE",
  "PLAY_OFF_ROUND",
  "PRELIMINARY_ROUND",
  "QUALIFICATION_ROUND_1",
  "QUALIFICATION_ROUND_2",
  "QUALIFICATION_ROUND_3",
  "LEAGUE_STAGE_PLAYOFF",
]);

/**
 * Determine if a match stage is a playoff/knockout stage.
 */
export function isPlayoffStage(stage: string | null): boolean {
  if (!stage) return false;
  return PLAYOFF_STAGES.has(stage);
}

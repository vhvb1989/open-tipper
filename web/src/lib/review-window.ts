/**
 * Post-match "Reviewing" window.
 *
 * A match can be reported FINISHED by the data provider before late events
 * (e.g. a yellow card shown in the final minute) have been aggregated into the
 * fixture statistics endpoint. Resolving risk payouts immediately at FINISHED
 * therefore locks in provisional stats that may still change.
 *
 * To avoid that, a FINISHED match that has risk predictions enters a short
 * review window: every sync poll we re-fetch its statistics and only resolve
 * risks once the numbers have settled (unchanged across consecutive polls) or a
 * hard poll cap is reached. The match `status` stays FINISHED throughout; the
 * window is tracked via separate `Match` fields and the UI derives a
 * "Reviewing" label from `status === FINISHED && !risksCompleted`.
 */

/** Hard cap on review polls before we resolve regardless of stability (~6 min at a 2-min cadence). */
export const REVIEW_MAX_POLLS = 3;

/**
 * Consecutive no-change review polls required to consider stats settled.
 * 1 means: one poll whose stats match the previously stored stats
 * (i.e. two equal consecutive samples).
 */
export const REVIEW_STABLE_REQUIRED = 1;

/** The four tracked statistic totals, as stored on MatchStats / produced by extractMatchStats. */
export interface ReviewStatTotals {
  yellowCards: number | null;
  redCards: number | null;
  cornerKicks: number | null;
  offsides: number | null;
}

/**
 * Whether freshly-fetched stats differ from what we already had stored.
 * A missing stored record counts as a change (first sample is never "stable").
 */
export function statsChanged(
  stored: ReviewStatTotals | null | undefined,
  fresh: ReviewStatTotals,
): boolean {
  if (!stored) return true;
  return (
    stored.yellowCards !== fresh.yellowCards ||
    stored.redCards !== fresh.redCards ||
    stored.cornerKicks !== fresh.cornerKicks ||
    stored.offsides !== fresh.offsides
  );
}

export interface ReviewCounters {
  reviewPollCount: number;
  reviewStableCount: number;
}

export interface ReviewAdvance {
  reviewPollCount: number;
  reviewStableCount: number;
  /** True once the review window has closed and risks may be resolved. */
  complete: boolean;
}

/**
 * Advance the review counters by one poll.
 *
 * @param prev    Current counters from the Match row.
 * @param changed Whether this poll's stats differed from the stored stats.
 */
export function advanceReview(prev: ReviewCounters, changed: boolean): ReviewAdvance {
  const reviewPollCount = prev.reviewPollCount + 1;
  const reviewStableCount = changed ? 0 : prev.reviewStableCount + 1;
  const complete =
    reviewStableCount >= REVIEW_STABLE_REQUIRED || reviewPollCount >= REVIEW_MAX_POLLS;
  return { reviewPollCount, reviewStableCount, complete };
}

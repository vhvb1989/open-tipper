/**
 * Post-match "Reviewing" window.
 *
 * A match can be reported FINISHED by the data provider before late events
 * (e.g. a stoppage-time offside/card) have been aggregated into the fixture
 * statistics endpoint. API-Football publishes no SLA: `/fixtures/statistics`
 * returns well-formed but PROVISIONAL values right at FT and then fills in late
 * events field-by-field over several minutes. Resolving risk payouts the moment
 * the numbers look "stable" is therefore unsafe — a provisional value is stable
 * precisely because the provider has not ingested the late event yet.
 *
 * To guard against that, a FINISHED match with risk predictions waits in a
 * review window before its risks resolve. Completion requires BOTH:
 *   - a minimum wall-clock delay since FT has elapsed (gives the provider time
 *     to ingest late events), AND
 *   - the stats have held steady across consecutive review polls,
 * with a hard time/poll cap as a backstop. The match `status` stays FINISHED
 * throughout; the window is tracked via separate `Match` fields and the UI
 * derives a "Reviewing" label from `status === FINISHED && !risksCompleted`.
 */

/** Minimum time after FT before risks may resolve, even if stats already look stable. */
export const MIN_REVIEW_WAIT_MS = 10 * 60 * 1000; // 10 minutes

/** Hard backstop: resolve once this much time has elapsed since FT regardless of stability. */
export const REVIEW_MAX_WAIT_MS = 16 * 60 * 1000; // 16 minutes

/**
 * Consecutive no-change review polls required (in addition to the minimum wait)
 * to consider stats settled. 2 means three equal consecutive samples.
 */
export const REVIEW_STABLE_REQUIRED = 2;

/**
 * Fallback poll-count cap, used only when the FT timestamp is unknown
 * (e.g. legacy rows migrated without finishedAt). At the ~2-minute cron cadence
 * this approximates REVIEW_MAX_WAIT_MS.
 */
export const REVIEW_MAX_POLLS = 8;

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

export interface ReviewInput {
  reviewPollCount: number;
  reviewStableCount: number;
  /** Whether this poll's stats differed from the stored stats. */
  changed: boolean;
  /** Milliseconds since FT was first observed, or null when unknown (legacy rows). */
  msSinceFinished: number | null;
}

export interface ReviewAdvance {
  reviewPollCount: number;
  reviewStableCount: number;
  /** True once the review window has closed and risks may be resolved. */
  complete: boolean;
}

/**
 * Advance the review counters by one poll and decide whether the window closes.
 *
 * Closes when EITHER:
 *   - the hard cap is reached (REVIEW_MAX_WAIT_MS elapsed, or REVIEW_MAX_POLLS
 *     polls when the FT timestamp is unknown), OR
 *   - the minimum wait has elapsed AND stats have been stable for
 *     REVIEW_STABLE_REQUIRED consecutive polls.
 */
export function advanceReview(input: ReviewInput): ReviewAdvance {
  const reviewPollCount = input.reviewPollCount + 1;
  const reviewStableCount = input.changed ? 0 : input.reviewStableCount + 1;

  const knownTime = input.msSinceFinished !== null;
  const minWaitMet = knownTime ? input.msSinceFinished! >= MIN_REVIEW_WAIT_MS : true;
  const stableMet = reviewStableCount >= REVIEW_STABLE_REQUIRED;
  const capMet = knownTime
    ? input.msSinceFinished! >= REVIEW_MAX_WAIT_MS
    : reviewPollCount >= REVIEW_MAX_POLLS;

  const complete = capMet || (minWaitMet && stableMet);
  return { reviewPollCount, reviewStableCount, complete };
}

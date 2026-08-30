/**
 * Fee estimation with surge-pricing awareness (issue #1117).
 *
 * A flat fee estimate ignores Stellar network congestion, where the
 * inclusion fee on a busy ledger can run several times the base fee. This
 * turns a single point estimate into a range (typical → worst-case) driven
 * by recent ledger fee-charged data, so the UI can show "~0.00001–0.0001
 * XLM" instead of a number that can be off by 10x.
 */

export interface FeeEstimateRange {
  /** Typical-case fee estimate, in stroops. */
  typicalStroops: bigint;
  /** Worst-case (surge-adjusted) fee estimate, in stroops. */
  worstCaseStroops: bigint;
  /** Multiplier applied to derive the worst case from the base estimate. */
  surgeMultiplier: number;
  /** True when recent samples indicate the network is currently congested. */
  isCongested: boolean;
}

/** Minimum multiplier applied even when the network looks idle. */
const MIN_SURGE_MULTIPLIER = 1;
/** Multiplier used once recent fees indicate real congestion. */
const CONGESTED_SURGE_MULTIPLIER = 10;
/**
 * Ratio of max-observed to base fee above which we treat the network as
 * congested, based on recent ledger fee stats.
 */
const CONGESTION_RATIO_THRESHOLD = 3;

/**
 * Build a fee range from a base fee estimate and recent ledger fee stats
 * (e.g. Soroban RPC's `getFeeStats().sorobanInclusionFee`).
 */
export function estimateFeeRange(
  baseFeeStroops: bigint,
  recentMaxFeeChargedStroops: bigint,
): FeeEstimateRange {
  const ratio =
    baseFeeStroops > 0n
      ? Number(recentMaxFeeChargedStroops) / Number(baseFeeStroops)
      : 0;

  const isCongested = ratio >= CONGESTION_RATIO_THRESHOLD;
  const surgeMultiplier = isCongested ? CONGESTED_SURGE_MULTIPLIER : MIN_SURGE_MULTIPLIER;

  return {
    typicalStroops: baseFeeStroops,
    worstCaseStroops: baseFeeStroops * BigInt(surgeMultiplier),
    surgeMultiplier,
    isCongested,
  };
}

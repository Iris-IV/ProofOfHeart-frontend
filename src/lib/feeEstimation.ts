/**
 * Fee estimation with surge-pricing awareness (issue #1117) and inclusion-fee
 * buffers for network congestion (issue #1501).
 *
 * A flat fee estimate ignores Stellar network congestion, where the
 * inclusion fee on a busy ledger can run several times the base fee. This
 * turns a single point estimate into a range (typical → worst-case) driven
 * by recent ledger fee-charged data, so the UI can show "~0.00001–0.0001
 * XLM" instead of a number that can be off by 10x.
 *
 * On top of the range, `recommendedFeeCapStroops` adds a congestion-aware
 * buffer so a transaction built during a fee surge still lands in the next
 * few ledgers instead of being dropped and resubmitted.
 *
 * ## Units and arithmetic
 * Every fee here is a `bigint` number of stroops (1 XLM = 10 000 000 stroops);
 * only the congestion ratio is a floating-point `number`. Percentages are in
 * basis points (10 000 bps = 100 %) and buffer math rounds down.
 *
 * ## Pipeline
 * 1. `estimateFeeRange(base, recentMax)` -> typical and surge-adjusted worst case.
 * 2. `effectiveFeeBufferBps(range, options)` -> headroom percentage for the
 *    current conditions.
 * 3. `calculateInclusionFeeBuffer(range, options)` -> headroom in stroops.
 * 4. `recommendedFeeCapStroops(range, options)` -> worst case + headroom, the
 *    value to show as the "max fee" and to use as the fee ceiling.
 *
 * Full specification, worked examples and edge cases: `docs/FEE_ESTIMATION.md`.
 * The exact per-transaction estimate shown in the donation dialog comes from a
 * simulation instead (`estimateContributeNetworkFee` in `contractClient.ts`).
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
 * (e.g. Soroban RPC's `getFeeStats().sorobanInclusionFee.max`).
 *
 * The network is "congested" when `recentMaxFeeChargedStroops / baseFeeStroops`
 * is at least {@link CONGESTION_RATIO_THRESHOLD} (3); the worst case is then the
 * base fee times 10, otherwise it equals the base fee. A non-positive base fee
 * is treated as idle (no division by zero).
 *
 * @param baseFeeStroops Typical fee for the transaction, in stroops.
 * @param recentMaxFeeChargedStroops Highest recently charged inclusion fee, in stroops.
 */
export function estimateFeeRange(
  baseFeeStroops: bigint,
  recentMaxFeeChargedStroops: bigint,
): FeeEstimateRange {
  const ratio =
    baseFeeStroops > 0n ? Number(recentMaxFeeChargedStroops) / Number(baseFeeStroops) : 0;

  const isCongested = ratio >= CONGESTION_RATIO_THRESHOLD;
  const surgeMultiplier = isCongested ? CONGESTED_SURGE_MULTIPLIER : MIN_SURGE_MULTIPLIER;

  return {
    typicalStroops: baseFeeStroops,
    worstCaseStroops: baseFeeStroops * BigInt(surgeMultiplier),
    surgeMultiplier,
    isCongested,
  };
}

// ---------------------------------------------------------------------------
// Inclusion-fee buffers (#1501)
//
// The worst-case range tells the user how high fees can go, but a transaction
// still needs headroom on top of that to survive a fee surge between build
// time and ledger close. The buffer scales with congestion: modest when idle
// (avoid overpaying) and generous under surge (avoid dropped transactions and
// the retry churn that follows).
// ---------------------------------------------------------------------------

/** Basis-point denominator for buffer math (100% = 10 000 bps). */
const BUFFER_BPS_DENOMINATOR = 10_000n;

/** Extra headroom over the worst case while the network is idle: 10%. */
export const DEFAULT_FEE_BUFFER_BPS = 1_000;
/** Extra headroom over the worst case during congestion: 50%. */
export const DEFAULT_CONGESTION_FEE_BUFFER_BPS = 5_000;

export interface GasBufferOptions {
  /** Headroom over the worst-case fee while idle, in bps. Default: 1 000 (10%). */
  bufferBps?: number;
  /** Headroom used instead while congested, in bps. Default: 5 000 (50%). */
  congestionBufferBps?: number;
}

function clampBps(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.trunc(value);
}

/**
 * The buffer percentage (in bps) to apply to the worst-case estimate for the
 * given network conditions. Congested networks use `congestionBufferBps`;
 * idle networks use `bufferBps`.
 *
 * While congested the larger of the two is used, so a custom idle buffer can
 * never reduce congestion headroom. Negative, `NaN` or infinite options fall
 * back to the defaults; fractional values are truncated.
 */
export function effectiveFeeBufferBps(range: FeeEstimateRange, options?: GasBufferOptions): number {
  const idle = clampBps(options?.bufferBps ?? DEFAULT_FEE_BUFFER_BPS, DEFAULT_FEE_BUFFER_BPS);
  const congested = clampBps(
    options?.congestionBufferBps ?? DEFAULT_CONGESTION_FEE_BUFFER_BPS,
    DEFAULT_CONGESTION_FEE_BUFFER_BPS,
  );
  return range.isCongested ? Math.max(idle, congested) : idle;
}

/**
 * The additional stroops added on top of the worst-case fee to absorb an
 * inclusion-fee surge: `worstCase * bps / 10 000`, rounded down (so it can be
 * `0n` for very small fees).
 */
export function calculateInclusionFeeBuffer(
  range: FeeEstimateRange,
  options?: GasBufferOptions,
): bigint {
  const bps = BigInt(effectiveFeeBufferBps(range, options));
  return (range.worstCaseStroops * bps) / BUFFER_BPS_DENOMINATOR;
}

/**
 * The fee cap (in stroops) to apply to a transaction: the worst-case estimate
 * plus the congestion-aware inclusion-fee buffer. This is the value UIs should
 * present as the "max fee" and builders should use as the fee ceiling, so a
 * transaction is not dropped and rebuilt when fees spike between estimation
 * and submission.
 */
export function recommendedFeeCapStroops(
  range: FeeEstimateRange,
  options?: GasBufferOptions,
): bigint {
  return range.worstCaseStroops + calculateInclusionFeeBuffer(range, options);
}

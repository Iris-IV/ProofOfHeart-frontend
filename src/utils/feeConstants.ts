/**
 * Basis-point (bps) constants for platform/revenue-share fees.
 *
 * Extracted so the 5000 / 10000 magic numbers scattered across
 * validators, admin UI, and fee-display components share one source
 * of truth. 1 bps = 0.01%.
 */

/** Denominator for basis-point math: amount * bps / BPS_DENOMINATOR. */
export const BPS_DENOMINATOR = 10000;

/** Maximum allowed revenue-share / platform fee, in bps (50%). */
export const MAX_FEE_BPS = 5000;

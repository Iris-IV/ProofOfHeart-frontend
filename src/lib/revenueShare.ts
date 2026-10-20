/**
 * Creator-side revenue-sharing math and bookkeeping (issue #1675).
 *
 * The contract pays the creator `pool × (10,000 − revenue_share_percentage) / 10,000`
 * minus whatever they already claimed, but exposes no view for the creator's
 * claimed total. The panel therefore remembers, per wallet and campaign, how
 * much entitlement a confirmed `claim_creator_revenue` has already settled.
 * It is only a display aid: the contract stays the source of truth and rejects
 * an over-claim with `NoFundsToWithdraw`.
 */

const BPS_DENOMINATOR = 10_000;
const STORAGE_PREFIX = "poh_creator_revenue_claimed_";

/** Total revenue the creator retains, using the contract's integer math. */
export function creatorRevenueEntitlement(pool: bigint, revenueSharePercentage: number): bigint {
  const creatorBps = BigInt(Math.max(0, BPS_DENOMINATOR - revenueSharePercentage));
  return (pool * creatorBps) / BigInt(BPS_DENOMINATOR);
}

/** Entitlement still unclaimed, never negative. */
export function creatorClaimableAmount(entitlement: bigint, alreadyClaimed: bigint): bigint {
  return entitlement > alreadyClaimed ? entitlement - alreadyClaimed : BigInt(0);
}

const storageKey = (campaignId: number, creator: string) =>
  `${STORAGE_PREFIX}${creator}_${campaignId}`;

export function readCreatorClaimed(campaignId: number, creator: string | null): bigint {
  if (!creator) return BigInt(0);
  try {
    const raw = localStorage.getItem(storageKey(campaignId, creator));
    return raw && /^\d+$/.test(raw) ? BigInt(raw) : BigInt(0);
  } catch {
    return BigInt(0);
  }
}

export function writeCreatorClaimed(campaignId: number, creator: string, amount: bigint): void {
  try {
    localStorage.setItem(storageKey(campaignId, creator), amount.toString());
  } catch {
    // Storage unavailable: the contract still enforces the real limit.
  }
}

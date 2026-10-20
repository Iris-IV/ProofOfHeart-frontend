/**
 * Campaign lifecycle bits, mirrored from the contract's `status: u32` field.
 *
 * Source of truth: `ProofOfHeart-stellar/src/types.rs` (the `CAMPAIGN_*`
 * constants and the `Campaign::is_*` accessors). The contract keeps lifecycle
 * state as one bitfield rather than separate booleans, so the frontend has to
 * decode it. If the contract changes these values, change them here too.
 */

export const CAMPAIGN_ACTIVE = 1 << 0;
/** The contract calls this bit "paused"; a campaign with it set is cancelled. */
export const CAMPAIGN_PAUSED = 1 << 1;
export const CAMPAIGN_VALIDATED = 1 << 2;
/** The contract calls this bit "succeeded"; it is set once funds are withdrawn. */
export const CAMPAIGN_SUCCEEDED = 1 << 3;

export interface CampaignStatusFlags {
  is_active: boolean;
  is_cancelled: boolean;
  is_verified: boolean;
  funds_withdrawn: boolean;
}

/** Decode the contract's `status` bitfield into the booleans the UI uses. */
export function decodeCampaignStatusFlags(status: number): CampaignStatusFlags {
  return {
    is_active: (status & CAMPAIGN_ACTIVE) !== 0,
    is_cancelled: (status & CAMPAIGN_PAUSED) !== 0,
    is_verified: (status & CAMPAIGN_VALIDATED) !== 0,
    funds_withdrawn: (status & CAMPAIGN_SUCCEEDED) !== 0,
  };
}

/**
 * Donation escrow state derivation (issue #1119).
 *
 * The contract tracks a contribution's lifecycle but the frontend only
 * ever showed raw campaign flags, not a distinguishable escrow state. This
 * derives one from the campaign/contribution data already returned by the
 * contract client, so the UI can label a donation as still held, released
 * to the creator, or refunded to the donor.
 */

export type EscrowState = "deposited" | "released" | "refunded";

export interface EscrowStateInput {
  /** True once the creator has withdrawn the raised funds. */
  fundsWithdrawn: boolean;
  /** True once the campaign has been cancelled (refund path). */
  isCancelled: boolean;
  /** True if this specific contribution has been refunded to the donor. */
  contributionRefunded?: boolean;
}

/**
 * Derive the escrow state for one contribution from campaign/contribution
 * flags. Precedence: an explicit per-contribution refund always wins, then
 * a cancelled campaign implies refunded, then a withdrawn campaign implies
 * released; otherwise funds are still held in escrow.
 */
export function deriveEscrowState(input: EscrowStateInput): EscrowState {
  if (input.contributionRefunded || input.isCancelled) {
    return "refunded";
  }
  if (input.fundsWithdrawn) {
    return "released";
  }
  return "deposited";
}

export const ESCROW_STATE_LABEL: Record<EscrowState, string> = {
  deposited: "Held in escrow",
  released: "Released to creator",
  refunded: "Refunded to donor",
};

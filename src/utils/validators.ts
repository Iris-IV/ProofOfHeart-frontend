import { StrKey } from "@stellar/stellar-sdk";
import { ContractError, ContractErrorException } from "./contractErrors";
import { MAX_FEE_BPS } from "./feeConstants";

export function validateStellarAddress(
  address: string,
  errorToThrow: ContractError = ContractError.ValidationFailed,
): void {
  if (!address || address.length !== 56 || !address.startsWith("G")) {
    throw new ContractErrorException(errorToThrow);
  }
}

/**
 * Non-throwing check that `address` is a syntactically valid Stellar ed25519
 * public key — starts with `G`, has the correct length, and a valid StrKey
 * checksum. Intended for client-side form validation where an inline error is
 * shown rather than an exception thrown (see TransferAdminModal). Unlike
 * {@link validateStellarAddress}, this verifies the checksum, not just the
 * length and prefix.
 */
export function isValidStellarPublicKey(address: string): boolean {
  return typeof address === "string" && StrKey.isValidEd25519PublicKey(address.trim());
}

export function validateAmount(amount: number | bigint): void {
  const numeric = Number(amount);
  // `Number(amount) <= 0` alone lets a NaN amount (e.g. from a malformed
  // upstream conversion) slip through, since `NaN <= 0` is false — reject
  // non-finite values explicitly so a zero/invalid contribution can never
  // reach the contract call (issue #1122).
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new ContractErrorException(ContractError.ContributionMustBePositive);
  }
}

export function validateFundingGoal(goal: number | bigint): void {
  if (Number(goal) <= 0) {
    throw new ContractErrorException(ContractError.FundingGoalMustBePositive);
  }
}

export function validateDuration(days: number): void {
  if (days < 1 || days > 365) {
    throw new ContractErrorException(ContractError.InvalidDuration);
  }
}

export function validateRevenueShare(bps: number): void {
  if (bps < 1 || bps > MAX_FEE_BPS) {
    throw new ContractErrorException(ContractError.InvalidRevenueShare);
  }
}

export function validateContributorNotCreator(contributor: string, creator: string): void {
  if (contributor && creator && contributor === creator) {
    throw new ContractErrorException(ContractError.NotAuthorized);
  }
}

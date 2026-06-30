import { ContractError, ContractErrorException } from "./contractErrors";

export function validateStellarAddress(
  address: string,
  errorToThrow: ContractError = ContractError.ValidationFailed,
): void {
  if (!address || address.length !== 56 || !address.startsWith("G")) {
    throw new ContractErrorException(errorToThrow);
  }
}

export function validateAmount(amount: number | bigint): void {
  if (Number(amount) <= 0) {
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
  if (bps < 1 || bps > 5000) {
    throw new ContractErrorException(ContractError.InvalidRevenueShare);
  }
}

export function validateContributorNotCreator(contributor: string, creator: string): void {
  if (contributor && creator && contributor === creator) {
    throw new ContractErrorException(ContractError.NotAuthorized);
  }
}

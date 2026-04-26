/**
 * Soroban contract error codes and user-friendly messages.
 *
 * Error codes match the on-chain contract enum exactly.
 * Use parseContractError() to convert any thrown error (SDK or otherwise)
 * into a display-ready string before showing it to the user.
 */

// ---------------------------------------------------------------------------
// Enum — mirrors the on-chain contract
// ---------------------------------------------------------------------------

export enum ContractError {
  NotAuthorized = 1,
  CampaignNotFound = 2,
  CampaignNotActive = 3,
  FundingGoalMustBePositive = 4,
  InvalidDuration = 5,
  InvalidRevenueShare = 6,
  RevenueShareOnlyForStartup = 7,
  DeadlinePassed = 8,
  ContributionMustBePositive = 9,
  DeadlineNotPassed = 10,
  FundsAlreadyWithdrawn = 11,
  FundingGoalNotReached = 12,
  NoFundsToWithdraw = 13,
  CampaignAlreadyVerified = 14,
  ValidationFailed = 15,
  AlreadyVoted = 16,
  NotTokenHolder = 17,
  VotingQuorumNotMet = 18,
  VotingThresholdNotMet = 19,
}

// ---------------------------------------------------------------------------
// User-facing messages
// ---------------------------------------------------------------------------

export const errorMessages: Record<ContractError, string> = {
  [ContractError.NotAuthorized]: "You are not authorized to perform this action.",
  [ContractError.CampaignNotFound]: "This campaign could not be found.",
  [ContractError.CampaignNotActive]: "This campaign is no longer accepting contributions.",
  [ContractError.FundingGoalMustBePositive]: "The funding goal must be greater than zero.",
  [ContractError.InvalidDuration]: "The campaign duration is invalid.",
  [ContractError.InvalidRevenueShare]: "The revenue share percentage is invalid.",
  [ContractError.RevenueShareOnlyForStartup]:
    "Revenue sharing is only available for startup campaigns.",
  [ContractError.DeadlinePassed]: "The campaign deadline has passed.",
  [ContractError.ContributionMustBePositive]: "Please enter a valid contribution amount.",
  [ContractError.DeadlineNotPassed]: "The campaign deadline has not passed yet.",
  [ContractError.FundsAlreadyWithdrawn]: "The funds for this campaign have already been withdrawn.",
  [ContractError.FundingGoalNotReached]: "The funding goal has not been reached yet.",
  [ContractError.NoFundsToWithdraw]: "There are no funds available to withdraw.",
  [ContractError.CampaignAlreadyVerified]: "This campaign has already been verified.",
  [ContractError.ValidationFailed]: "Validation failed. Please check your input and try again.",
  [ContractError.AlreadyVoted]: "You have already voted on this campaign.",
  [ContractError.NotTokenHolder]: "You must hold the platform token to vote.",
  [ContractError.VotingQuorumNotMet]: "Not enough votes have been cast yet.",
  [ContractError.VotingThresholdNotMet]: "The approval threshold has not been reached.",
};

const FALLBACK_MESSAGE = "An unexpected error occurred. Please try again.";

// ---------------------------------------------------------------------------
// Typed error class
// ---------------------------------------------------------------------------

/**
 * Thrown by the contract client layer when the Soroban contract returns a
 * known error code. Catch this to get a strongly-typed code you can act on.
 */
export class ContractErrorException extends Error {
  constructor(public readonly code: ContractError) {
    super(errorMessages[code] ?? FALLBACK_MESSAGE);
    this.name = "ContractErrorException";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the user-friendly message for a numeric contract error code.
 * Falls back to a generic message for unknown codes.
 */
export function contractErrorMessage(code: number): string {
  if (code in ContractError) {
    return errorMessages[code as ContractError];
  }
  return FALLBACK_MESSAGE;
}

/**
 * Converts any thrown value from a contract call into a display-ready string.
 *
 * Handles:
 *  - ContractErrorException (our own typed errors)
 *  - Soroban SDK format:  "Error(Contract, #N)"
 *  - Generic Error with message
 *  - Unknown thrown values
 */
export function parseContractError(error: unknown): string {
  // Our own typed contract error
  if (error instanceof ContractErrorException) {
    return error.message;
  }

  if (error instanceof Error) {
    // Soroban SDK typically formats contract errors as "Error(Contract, #N)"
    const sorobanMatch = error.message.match(/Error\s*\(\s*Contract\s*,\s*#(\d+)\s*\)/i);
    if (sorobanMatch) {
      return contractErrorMessage(parseInt(sorobanMatch[1], 10));
    }

    // Alternative formats: "contractError: N" or "contract error N"
    const codeMatch = error.message.match(/contract\s*[Ee]rror[:\s]+(\d+)/);
    if (codeMatch) {
      return contractErrorMessage(parseInt(codeMatch[1], 10));
    }

    // Return the raw message if it looks human-readable (not a stack trace)
    if (error.message && !error.message.includes("at ") && error.message.length < 200) {
      return error.message;
    }
  }

  return FALLBACK_MESSAGE;
}

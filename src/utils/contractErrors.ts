/**
 * Soroban contract error codes and translation keys.
 *
 * Error codes match the on-chain contract enum exactly.
 * Use parseContractError() to convert any thrown error into a translation key.
 * Callers resolve the key via useTranslations('ContractErrors') or a t helper.
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
  InvalidVestingSchedule = 20,
  VestingCliffNotReached = 21,
  NoVestedTokensToClaim = 22,
  TokenNotConfigured = 23,
  ContractPaused = 24,
  ContributionCapExceeded = 25,
  CampaignNotVerified = 26,
  MultiSigSignerNotFound = 27,
  MultiSigThresholdNotMet = 28,
  InvalidMultiSigThreshold = 29,
  Overflow = 30,
  Underflow = 31,
  CreationDisabled = 32,
  InvalidCategory = 33,
  ProposalNotFound = 34,
  ProposalAlreadyExecuted = 35,
  ProposalExpired = 36,
  AlreadySignedProposal = 37,
  InsufficientSignatures = 38,
  InvalidBatchSize = 39,
  InvalidVestingCliff = 40,
  InvalidVestingDelay = 41,
}

// ---------------------------------------------------------------------------
// Translation keys (caller resolves via next-intl t function)
// ---------------------------------------------------------------------------

const FALLBACK_KEY = "ContractErrors.UnexpectedError";

export const errorTranslationKeys: Record<ContractError, string> = {
  [ContractError.NotAuthorized]: "ContractErrors.NotAuthorized",
  [ContractError.CampaignNotFound]: "ContractErrors.CampaignNotFound",
  [ContractError.CampaignNotActive]: "ContractErrors.CampaignNotActive",
  [ContractError.FundingGoalMustBePositive]: "ContractErrors.FundingGoalMustBePositive",
  [ContractError.InvalidDuration]: "ContractErrors.InvalidDuration",
  [ContractError.InvalidRevenueShare]: "ContractErrors.InvalidRevenueShare",
  [ContractError.RevenueShareOnlyForStartup]: "ContractErrors.RevenueShareOnlyForStartup",
  [ContractError.DeadlinePassed]: "ContractErrors.DeadlinePassed",
  [ContractError.ContributionMustBePositive]: "ContractErrors.ContributionMustBePositive",
  [ContractError.DeadlineNotPassed]: "ContractErrors.DeadlineNotPassed",
  [ContractError.FundsAlreadyWithdrawn]: "ContractErrors.FundsAlreadyWithdrawn",
  [ContractError.FundingGoalNotReached]: "ContractErrors.FundingGoalNotReached",
  [ContractError.NoFundsToWithdraw]: "ContractErrors.NoFundsToWithdraw",
  [ContractError.CampaignAlreadyVerified]: "ContractErrors.CampaignAlreadyVerified",
  [ContractError.ValidationFailed]: "ContractErrors.ValidationFailed",
  [ContractError.AlreadyVoted]: "ContractErrors.AlreadyVoted",
  [ContractError.NotTokenHolder]: "ContractErrors.NotTokenHolder",
  [ContractError.VotingQuorumNotMet]: "ContractErrors.VotingQuorumNotMet",
  [ContractError.VotingThresholdNotMet]: "ContractErrors.VotingThresholdNotMet",
  [ContractError.InvalidVestingSchedule]: "ContractErrors.InvalidVestingSchedule",
  [ContractError.VestingCliffNotReached]: "ContractErrors.VestingCliffNotReached",
  [ContractError.NoVestedTokensToClaim]: "ContractErrors.NoVestedTokensToClaim",
  [ContractError.TokenNotConfigured]: "ContractErrors.TokenNotConfigured",
  [ContractError.ContractPaused]: "ContractErrors.ContractPaused",
  [ContractError.ContributionCapExceeded]: "ContractErrors.ContributionCapExceeded",
  [ContractError.CampaignNotVerified]: "ContractErrors.CampaignNotVerified",
  [ContractError.MultiSigSignerNotFound]: "ContractErrors.MultiSigSignerNotFound",
  [ContractError.MultiSigThresholdNotMet]: "ContractErrors.MultiSigThresholdNotMet",
  [ContractError.InvalidMultiSigThreshold]: "ContractErrors.InvalidMultiSigThreshold",
  [ContractError.Overflow]: "ContractErrors.Overflow",
  [ContractError.Underflow]: "ContractErrors.Underflow",
  [ContractError.CreationDisabled]: "ContractErrors.CreationDisabled",
  [ContractError.InvalidCategory]: "ContractErrors.InvalidCategory",
  [ContractError.ProposalNotFound]: "ContractErrors.ProposalNotFound",
  [ContractError.ProposalAlreadyExecuted]: "ContractErrors.ProposalAlreadyExecuted",
  [ContractError.ProposalExpired]: "ContractErrors.ProposalExpired",
  [ContractError.AlreadySignedProposal]: "ContractErrors.AlreadySignedProposal",
  [ContractError.InsufficientSignatures]: "ContractErrors.InsufficientSignatures",
  [ContractError.InvalidBatchSize]: "ContractErrors.InvalidBatchSize",
  [ContractError.InvalidVestingCliff]: "ContractErrors.InvalidVestingCliff",
  [ContractError.InvalidVestingDelay]: "ContractErrors.InvalidVestingDelay",
};

// ---------------------------------------------------------------------------
// Typed error class
// ---------------------------------------------------------------------------

/**
 * Thrown by the contract client layer when the Soroban contract returns a
 * known error code. Catch this to get a strongly-typed code you can act on.
 */
export class ContractErrorException extends Error {
  constructor(public readonly code: ContractError) {
    super(`ContractError.${code}`);
    this.name = "ContractErrorException";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the numeric ContractError code from any thrown value.
 * Returns null if the error doesn't match a known contract error format.
 */
export function getContractErrorCode(error: unknown): ContractError | null {
  if (error instanceof ContractErrorException) {
    return error.code;
  }

  let message = "";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (typeof error === "object" && error !== null) {
    message = (error as any).message || (error as any).error?.message || JSON.stringify(error);
  }

  if (message) {
    // Soroban SDK typically formats contract errors as "Error(Contract, #N)"
    const sorobanMatch = message.match(/Error\s*\(\s*Contract\s*,\s*#(\d+)\s*\)/i);
    if (sorobanMatch) {
      const code = parseInt(sorobanMatch[1], 10);
      if (code in ContractError) {
        return code as ContractError;
      }
    }

    // Alternative formats: "contractError: N" or "contract error N"
    const codeMatch = message.match(/contract\s*[Ee]rror[:\s]+(\d+)/i);
    if (codeMatch) {
      const code = parseInt(codeMatch[1], 10);
      if (code in ContractError) {
        return code as ContractError;
      }
    }
  }

  return null;
}

/**
 * Returns the translation key for a numeric contract error code.
 * Falls back to a generic key for unknown codes.
 */
export function contractErrorKey(code: number): string {
  if (code in ContractError) {
    return errorTranslationKeys[code as ContractError] ?? FALLBACK_KEY;
  }
  return FALLBACK_KEY;
}

/**
 * Converts any thrown value from a contract call into a translation key.
 *
 * Handles:
 *  - ContractErrorException (our own typed errors)
 *  - Soroban SDK format:  "Error(Contract, #N)"
 *  - Generic Error with message (returns raw message so callers get human text)
 *  - Unknown thrown values (returns fallback key)
 *
 * Callers should resolve the returned string through their i18n t function:
 *   showError(tContractErrors(parseContractError(err)))
 */
export function parseContractError(error: unknown): string {
  const code = getContractErrorCode(error);
  if (code !== null) {
    return errorTranslationKeys[code] ?? FALLBACK_KEY;
  }

  let message = "";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (typeof error === "object" && error !== null) {
    message = (error as any).message || (error as any).error?.message || "";
  }

  // Return the raw message if it looks human-readable (not a stack trace)
  if (message && !message.includes("at ") && message.length < 200) {
    return message;
  }

  return FALLBACK_KEY;
}

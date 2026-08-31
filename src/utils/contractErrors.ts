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
  AlreadyClaimed = 20,
  InvalidMilestone = 21,
  MilestoneNotFound = 22,
  MilestoneAlreadyApproved = 23,
  ContractPaused = 24,
  ContributionCapExceeded = 25,
  CampaignNotVerified = 26,
  InvalidAmount = 27,
  TransferFailed = 28,
  InsufficientBalance = 29,
  Overflow = 30,
  Underflow = 31,
  CreationDisabled = 32,
  InvalidFee = 33,
  AlreadyInitialized = 34,
  NotInitialized = 35,
  InvalidAddress = 36,
  Expired = 37,
  InvalidSignature = 38,
  UnauthorizedAdmin = 39,
  InvalidVestingSchedule = 40,
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
  [ContractError.AlreadyClaimed]: "ContractErrors.AlreadyClaimed",
  [ContractError.InvalidMilestone]: "ContractErrors.InvalidMilestone",
  [ContractError.MilestoneNotFound]: "ContractErrors.MilestoneNotFound",
  [ContractError.MilestoneAlreadyApproved]: "ContractErrors.MilestoneAlreadyApproved",
  [ContractError.ContractPaused]: "ContractErrors.ContractPaused",
  [ContractError.ContributionCapExceeded]: "ContractErrors.ContributionCapExceeded",
  [ContractError.CampaignNotVerified]: "ContractErrors.CampaignNotVerified",
  [ContractError.InvalidAmount]: "ContractErrors.InvalidAmount",
  [ContractError.TransferFailed]: "ContractErrors.TransferFailed",
  [ContractError.InsufficientBalance]: "ContractErrors.InsufficientBalance",
  [ContractError.Overflow]: "ContractErrors.Overflow",
  [ContractError.Underflow]: "ContractErrors.Underflow",
  [ContractError.CreationDisabled]: "ContractErrors.CreationDisabled",
  [ContractError.InvalidFee]: "ContractErrors.InvalidFee",
  [ContractError.AlreadyInitialized]: "ContractErrors.AlreadyInitialized",
  [ContractError.NotInitialized]: "ContractErrors.NotInitialized",
  [ContractError.InvalidAddress]: "ContractErrors.InvalidAddress",
  [ContractError.Expired]: "ContractErrors.Expired",
  [ContractError.InvalidSignature]: "ContractErrors.InvalidSignature",
  [ContractError.UnauthorizedAdmin]: "ContractErrors.UnauthorizedAdmin",
  [ContractError.InvalidVestingSchedule]: "ContractErrors.InvalidVestingSchedule",
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

  const message = stringifyError(error);

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
 * Soroban errors are not consistent about where they put the useful detail:
 * simulation errors use `error`, submission errors may use `errorResult`, and
 * SDK/network wrappers often put it in `cause`. Flatten those shapes before
 * looking for a contract code or a well-known host error.
 */
function stringifyError(error: unknown, seen = new Set<unknown>()): string {
  if (error == null || seen.has(error)) return "";
  if (typeof error === "string") return error;
  if (typeof error === "number" || typeof error === "bigint") return String(error);
  if (typeof error !== "object") return "";

  seen.add(error);
  const value = error as Record<string, unknown>;
  const parts = [
    error instanceof Error ? error.message : "",
    stringifyError(value.error, seen),
    error instanceof Error ? "" : stringifyError(value.message, seen),
    stringifyError(value.errorResult, seen),
    stringifyError(value.result, seen),
    stringifyError(value.cause, seen),
    stringifyError(value.data, seen),
  ];
  return parts.filter(Boolean).join(" ");
}

/** Convert RPC/SDK revert shapes into stable, user-facing contract errors. */
export function normalizeContractError(
  error: unknown,
  fallback = "Transaction failed on-chain.",
): Error {
  const code = getContractErrorCode(error);
  if (code !== null) return new ContractErrorException(code);

  const detail = stringifyError(error);
  if (/insufficient\s+(?:balance|funds)|underfunded|tx_insufficient_balance/i.test(detail)) {
    return new ContractErrorException(ContractError.InsufficientBalance);
  }
  if (
    /auth(?:entication|orization)?\s+(?:failed|failure)|not authorized|unauthorized|tx_bad_auth/i.test(
      detail,
    )
  ) {
    return new ContractErrorException(ContractError.NotAuthorized);
  }

  if (error instanceof Error && error.message) return error;
  return new Error(detail || fallback);
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

  const message = stringifyError(error);

  // Return the raw message if it looks human-readable (not a stack trace)
  if (message && !message.includes("at ") && message.length < 200) {
    return message;
  }

  return FALLBACK_KEY;
}

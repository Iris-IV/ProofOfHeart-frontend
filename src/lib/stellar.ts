import { contractErrorKey, getContractErrorCode } from "../utils/contractErrors";

/**
 * Normalizes a Stellar address by trimming whitespace and converting to uppercase.
 * Stellar addresses (ED25519 public keys) are base32 and conventionally uppercase.
 */
export function normalizeAddress(address: string | null | undefined): string {
  if (!address) return "";
  return address.trim().toUpperCase();
}

/**
 * Compares two Stellar addresses for equality after normalization.
 * Returns true if both addresses refer to the same Stellar account.
 */
export function isSameAddress(
  addr1: string | null | undefined,
  addr2: string | null | undefined,
): boolean {
  if (!addr1 || !addr2) return false;
  return normalizeAddress(addr1) === normalizeAddress(addr2);
}

// ---------------------------------------------------------------------------
// Soroban contract error translation (#1514)
//
// Soroban reverts surface as strings like "HostError: Error(Contract, #101)".
// The numeric code is the only stable signal, and codes outside the known
// enum (custom/future contract errors such as #101) still need a
// user-facing message rather than a raw SDK string. parseSorobanError()
// turns any of those shapes into a typed error carrying:
//   - the numeric code (when one can be extracted),
//   - the i18n translation key (for next-intl `t()` resolution), and
//   - a localized fallback message for contexts without an i18n resolver.
// ---------------------------------------------------------------------------

export const CONTRACT_ERROR_FALLBACK_KEY = "ContractErrors.UnexpectedError";

/** Typed error for a Soroban contract revert, known or custom. */
export class SorobanContractError extends Error {
  /** Numeric contract error code (e.g. 101 for `Error(Contract, #101)`), or null when no code was found. */
  readonly code: number | null;
  /** i18n translation key, e.g. "ContractErrors.NotAuthorized". */
  readonly translationKey: string;
  /** Locale-appropriate user-facing message. */
  readonly localizedMessage: string;

  constructor(code: number | null, translationKey: string, localizedMessage: string) {
    super(localizedMessage);
    this.name = "SorobanContractError";
    this.code = code;
    this.translationKey = translationKey;
    this.localizedMessage = localizedMessage;
  }
}

type ContractErrorMessages = Record<string, string>;

/**
 * Localized fallback messages keyed by translation-key suffix
 * ("NotAuthorized", "CampaignNotFound", …), mirroring messages/en.json and
 * messages/es.json so callers without a next-intl resolver still show a
 * human-readable string instead of "Error(Contract, #N)".
 */
const CONTRACT_ERROR_MESSAGES: Record<string, ContractErrorMessages> = {
  en: {
    NotAuthorized: "You are not authorized to perform this action.",
    CampaignNotFound: "This campaign could not be found.",
    CampaignNotActive: "This campaign is no longer accepting contributions.",
    FundingGoalMustBePositive: "The funding goal must be greater than zero.",
    InvalidDuration: "The campaign duration is invalid.",
    InvalidRevenueShare: "The revenue share percentage is invalid.",
    RevenueShareOnlyForStartup: "Revenue sharing is only available for startup campaigns.",
    DeadlinePassed: "The campaign deadline has passed.",
    ContributionMustBePositive: "Please enter a valid contribution amount.",
    DeadlineNotPassed: "The campaign deadline has not passed yet.",
    FundsAlreadyWithdrawn: "The funds for this campaign have already been withdrawn.",
    FundingGoalNotReached: "The funding goal has not been reached yet.",
    NoFundsToWithdraw: "There are no funds available to withdraw.",
    CampaignAlreadyVerified: "This campaign has already been verified.",
    ValidationFailed: "Validation failed. Please check your input and try again.",
    AlreadyVoted: "You have already voted on this campaign.",
    NotTokenHolder: "You must hold the platform token to vote.",
    VotingQuorumNotMet: "Not enough votes have been cast yet.",
    VotingThresholdNotMet: "The approval threshold has not been reached.",
    AlreadyClaimed: "This reward has already been claimed.",
    InvalidMilestone: "Invalid milestone.",
    MilestoneNotFound: "Milestone not found.",
    MilestoneAlreadyApproved: "Milestone already approved.",
    ContractPaused: "Contract is paused.",
    ContributionCapExceeded: "Contribution cap exceeded.",
    CampaignNotVerified: "Campaign not verified.",
    InvalidAmount: "Invalid amount.",
    TransferFailed: "Transfer failed.",
    InsufficientBalance: "Insufficient balance.",
    Overflow: "Arithmetic overflow.",
    Underflow: "Arithmetic underflow.",
    CreationDisabled: "Campaign creation is disabled.",
    InvalidFee: "Invalid fee.",
    AlreadyInitialized: "Already initialized.",
    NotInitialized: "Not initialized.",
    InvalidAddress: "Invalid address.",
    Expired: "Expired.",
    InvalidSignature: "Invalid signature.",
    UnauthorizedAdmin: "Unauthorized admin.",
    InvalidVestingSchedule: "Invalid vesting schedule.",
    InvalidVestingDelay: "Invalid vesting delay.",
    MilestoneNotVerified: "Milestone has not been verified yet.",
    MilestoneAlreadyClaimed: "Milestone payout has already been claimed.",
    UnexpectedError: "An unexpected error occurred. Please try again.",
  },
  es: {
    NotAuthorized: "No estás autorizado para realizar esta acción.",
    CampaignNotFound: "No se pudo encontrar esta campaña.",
    CampaignNotActive: "Esta campaña ya no acepta contribuciones.",
    FundingGoalMustBePositive: "El objetivo de financiación debe ser mayor que cero.",
    InvalidDuration: "La duración de la campaña no es válida.",
    InvalidRevenueShare: "El porcentaje de participación en los ingresos no es válido.",
    RevenueShareOnlyForStartup:
      "La participación en los ingresos solo está disponible para campañas de startups.",
    DeadlinePassed: "El plazo de la campaña ha vencido.",
    ContributionMustBePositive: "Por favor, introduce un monto de contribución válido.",
    DeadlineNotPassed: "El plazo de la campaña aún no ha vencido.",
    FundsAlreadyWithdrawn: "Los fondos de esta campaña ya han sido retirados.",
    FundingGoalNotReached: "El objetivo de financiación aún no se ha alcanzado.",
    NoFundsToWithdraw: "No hay fondos disponibles para retirar.",
    CampaignAlreadyVerified: "Esta campaña ya ha sido verificada.",
    ValidationFailed: "La validación falló. Por favor, revisa tu entrada e inténtalo de nuevo.",
    AlreadyVoted: "Ya has votado en esta campaña.",
    NotTokenHolder: "Debes poseer el token de la plataforma para votar.",
    VotingQuorumNotMet: "Aún no se han emitido suficientes votos.",
    VotingThresholdNotMet: "No se ha alcanzado el umbral de aprobación.",
    AlreadyClaimed: "Esta recompensa ya ha sido reclamada.",
    InvalidMilestone: "Hito inválido.",
    MilestoneNotFound: "Hito no encontrado.",
    MilestoneAlreadyApproved: "Hito ya aprobado.",
    ContractPaused: "El contrato está pausado.",
    ContributionCapExceeded: "Límite de contribución excedido.",
    CampaignNotVerified: "Campaña no verificada.",
    InvalidAmount: "Monto inválido.",
    TransferFailed: "Transferencia fallida.",
    InsufficientBalance: "Saldo insuficiente.",
    Overflow: "Desbordamiento aritmético.",
    Underflow: "Subdesbordamiento.",
    CreationDisabled: "La creación de campañas está deshabilitada.",
    InvalidFee: "Tarifa inválida.",
    AlreadyInitialized: "Ya inicializado.",
    NotInitialized: "No inicializado.",
    InvalidAddress: "Dirección inválida.",
    Expired: "Expirado.",
    InvalidSignature: "Firma inválida.",
    UnauthorizedAdmin: "Administrador no autorizado.",
    InvalidVestingSchedule: "Calendario de vesting inválido.",
    InvalidVestingDelay: "Retraso de vesting inválido.",
    MilestoneNotVerified: "El hito aún no ha sido verificado.",
    MilestoneAlreadyClaimed: "El pago del hito ya ha sido reclamado.",
    UnexpectedError: "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.",
  },
};

function contractErrorMessage(code: number | null, locale: string): string {
  const messages = CONTRACT_ERROR_MESSAGES[locale] ?? CONTRACT_ERROR_MESSAGES.en;
  if (code === null) return messages.UnexpectedError;
  const translationKey = contractErrorKey(code);
  if (translationKey !== CONTRACT_ERROR_FALLBACK_KEY) {
    const suffix = translationKey.split(".")[1] ?? "UnexpectedError";
    const known = messages[suffix] ?? CONTRACT_ERROR_MESSAGES.en[suffix];
    if (known) return known;
  }
  // Custom/future contract codes (e.g. #101) that are outside the known enum.
  return locale === "es"
    ? `El contrato rechazó esta transacción (error #${code}).`
    : `The contract rejected this transaction (error #${code}).`;
}

/** Flatten the shapes Soroban RPC/SDK errors come in, to a searchable string. */
function collectErrorMessage(error: unknown, seen = new Set<unknown>()): string {
  if (error == null || seen.has(error)) return "";
  if (typeof error === "string") return error;
  if (typeof error === "number" || typeof error === "bigint") return String(error);
  if (typeof error !== "object") return "";

  seen.add(error);
  const value = error as Record<string, unknown>;
  return [
    error instanceof Error ? error.message : "",
    collectErrorMessage(value.error, seen),
    error instanceof Error ? "" : collectErrorMessage(value.message, seen),
    collectErrorMessage(value.errorResult, seen),
    collectErrorMessage(value.cause, seen),
  ]
    .filter(Boolean)
    .join(" ");
}

/** Raw `Error(Contract, #N)` extraction, including codes outside the known enum. */
function extractRawContractCode(error: unknown): number | null {
  const match = collectErrorMessage(error).match(/Error\s*\(\s*Contract\s*,\s*#(\d+)\s*\)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Converts any thrown value from a Soroban contract interaction into a typed
 * SorobanContractError with a localized message.
 *
 * Handles:
 *  - Known contract codes ("Error(Contract, #3)" → CampaignNotActive)
 *  - Custom/unknown contract codes ("Error(Contract, #101)" → message including the code)
 *  - Arbitrary errors (falls back to the original message or the fallback text)
 */
export function parseSorobanError(
  error: unknown,
  locale: string = "en",
  fallback?: string,
): SorobanContractError {
  const knownCode = getContractErrorCode(error);
  if (knownCode !== null) {
    const translationKey = contractErrorKey(knownCode);
    return new SorobanContractError(
      knownCode,
      translationKey,
      contractErrorMessage(knownCode, locale),
    );
  }

  const rawCode = extractRawContractCode(error);
  if (rawCode !== null) {
    return new SorobanContractError(
      rawCode,
      CONTRACT_ERROR_FALLBACK_KEY,
      contractErrorMessage(rawCode, locale),
    );
  }

  const detail = collectErrorMessage(error);
  const message = detail || fallback || contractErrorMessage(null, locale);
  return new SorobanContractError(null, CONTRACT_ERROR_FALLBACK_KEY, message);
}

/**
 * Convenience wrapper returning only the localized user-facing message for a
 * contract error. Unknown revert codes (e.g. #101) are described with the
 * numeric code so the string is still actionable for support.
 */
export function localizedContractErrorMessage(
  error: unknown,
  locale: string = "en",
  fallback?: string,
): string {
  return parseSorobanError(error, locale, fallback).localizedMessage;
}

// ---------------------------------------------------------------------------
// Ledger state consistency (#1514)
//
// Client caches (campaign data, revenue pools, contribution ledgers) can
// silently diverge from on-chain state when RPC nodes lag or a transaction
// lands in a ledger the client has not observed yet. These helpers validate
// a cached snapshot against the current remote ledger sequence so UI code can
// either re-fetch or show a stale-data indicator instead of rendering
// inconsistent numbers.
// ---------------------------------------------------------------------------

/** A cached value paired with the ledger sequence it was read at. */
export interface LedgerStateSnapshot {
  /** Ledger sequence the value was read from. */
  ledgerSequence: number;
  /** Epoch ms when the snapshot was taken. */
  cachedAt: number;
}

export interface LedgerConsistencyOptions {
  /** Maximum snapshot age before it is considered stale. Default: 30 s. */
  maxAgeMs?: number;
  /** Maximum ledger-sequence lag tolerated between snapshot and remote. Default: 2. */
  maxLag?: number;
  /** Injectable clock (epoch ms) for deterministic tests. */
  now?: number;
}

export interface LedgerConsistencyResult {
  /** True when the snapshot is both fresh enough and within the allowed lag. */
  consistent: boolean;
  /** remoteLedgerSequence − snapshot.ledgerSequence (negative if snapshot is ahead). */
  lag: number;
  /** Age of the snapshot at evaluation time, in ms. */
  ageMs: number;
  /** Why the check failed; absent when consistent. */
  reason?: "stale_snapshot" | "ledger_drift" | "timeout";
}

const DEFAULT_MAX_SNAPSHOT_AGE_MS = 30_000;
const DEFAULT_MAX_LEDGER_LAG = 2;

/**
 * Validates a cached snapshot against the current remote ledger sequence.
 * A snapshot is consistent when it is within maxAgeMs of `now` and no more
 * than maxLag ledgers behind the remote head.
 */
export function checkLedgerStateConsistency(
  snapshot: LedgerStateSnapshot,
  currentLedgerSequence: number,
  options?: LedgerConsistencyOptions,
): LedgerConsistencyResult {
  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_MAX_SNAPSHOT_AGE_MS;
  const maxLag = options?.maxLag ?? DEFAULT_MAX_LEDGER_LAG;
  const now = options?.now ?? Date.now();

  const ageMs = Math.max(0, now - snapshot.cachedAt);
  const lag = currentLedgerSequence - snapshot.ledgerSequence;

  if (ageMs > maxAgeMs) {
    return { consistent: false, lag, ageMs, reason: "stale_snapshot" };
  }
  if (lag > maxLag) {
    return { consistent: false, lag, ageMs, reason: "ledger_drift" };
  }
  return { consistent: true, lag, ageMs };
}

export interface WaitForConsistentLedgerOptions extends LedgerConsistencyOptions {
  /** Give up after this many ms. Default: 10 000. */
  timeoutMs?: number;
  /** Delay between polls. Default: 1 000. */
  pollIntervalMs?: number;
}

/**
 * Polls readRemoteLedgerSequence until the snapshot passes the consistency
 * check or the timeout elapses. Under transient RPC lag the remote sequence
 * catches up within a ledger or two, so a short poll window resolves most
 * "UI shows stale numbers right after a transaction" reports without a
 * manual refresh.
 */
export async function waitForConsistentLedgerState(
  readRemoteLedgerSequence: () => Promise<number>,
  snapshot: LedgerStateSnapshot,
  options?: WaitForConsistentLedgerOptions,
): Promise<LedgerConsistencyResult> {
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const pollIntervalMs = options?.pollIntervalMs ?? 1_000;
  const startedAt = options?.now ?? Date.now();

  for (;;) {
    const currentSequence = await readRemoteLedgerSequence();
    const result = checkLedgerStateConsistency(snapshot, currentSequence, {
      ...options,
      now: Date.now(),
    });
    if (result.consistent) return result;

    const elapsed = Date.now() - startedAt;
    if (elapsed >= timeoutMs) {
      return { ...result, consistent: false, reason: "timeout" };
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(pollIntervalMs, timeoutMs - elapsed)),
    );
  }
}

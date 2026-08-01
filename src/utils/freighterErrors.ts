/**
 * Detects and maps raw Freighter wallet errors into user-facing messages,
 * similar in spirit to contractErrors.ts.
 *
 * Use parseFreighterError() to convert any thrown value from a Freighter
 * interaction into a human-readable message. Callers that need to act on the
 * error type can use wrapFreighterError(), which re-throws typed errors
 * (UserCancelledError / FreighterExtensionNotInstalledError).
 */

export const USER_CANCELLED_MESSAGE = "Transaction cancelled";
export const FREIGHTER_NOT_INSTALLED_MESSAGE =
  "Freighter extension is not installed. Please install it and try again.";
export const GENERIC_FREIGHTER_ERROR_MESSAGE = "Wallet request failed. Please try again.";

export class UserCancelledError extends Error {
  constructor() {
    super(USER_CANCELLED_MESSAGE);
    this.name = "UserCancelledError";
  }
}

export class FreighterExtensionNotInstalledError extends Error {
  constructor() {
    super(FREIGHTER_NOT_INSTALLED_MESSAGE);
    this.name = "FreighterExtensionNotInstalledError";
  }
}

const CANCEL_PATTERNS = [
  "user declined",
  "user rejected",
  "user cancelled",
  "user canceled",
  "request cancelled",
  "request canceled",
  "denied by user",
  "User Cancelled",
  "User Rejected",
];

const NOT_INSTALLED_PATTERNS = [
  "not installed",
  "is not defined",
  "window.freighter",
  "no freighter",
  "freighter is not available",
  "freighter is required",
  "freighter not detected",
];

/** Extracts a readable message from any thrown value, or "" when there is none. */
function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message ?? "";
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; error?: { message?: unknown } };
    if (typeof candidate.message === "string") return candidate.message;
    if (candidate.error && typeof candidate.error.message === "string") {
      return candidate.error.message;
    }
    return "";
  }
  return "";
}

/** True when the user rejected/cancelled the signature request. */
export function isUserRejection(error: unknown): boolean {
  const lower = errorMessage(error).toLowerCase();
  return CANCEL_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

/** True when Freighter reports the extension is missing/unavailable. */
export function isExtensionNotInstalled(error: unknown): boolean {
  const lower = errorMessage(error).toLowerCase();
  return NOT_INSTALLED_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

/**
 * Maps any thrown value from a Freighter interaction to a user-facing message.
 * Recognized cases (user rejection / missing extension) map to specific
 * messages; anything unrecognized falls back to a generic message rather than
 * crashing on unexpected shapes.
 */
export function parseFreighterError(error: unknown): string {
  if (isUserRejection(error)) return USER_CANCELLED_MESSAGE;
  if (isExtensionNotInstalled(error)) return FREIGHTER_NOT_INSTALLED_MESSAGE;
  return errorMessage(error) || GENERIC_FREIGHTER_ERROR_MESSAGE;
}

/**
 * Re-throws a Freighter error as a typed error when it represents a known
 * case (user rejection / extension not installed), otherwise re-throws the
 * original value unchanged. Always throws, so it is safe to call as the last
 * statement of a catch block.
 */
export function wrapFreighterError(error: unknown): never {
  if (isUserRejection(error)) throw new UserCancelledError();
  if (isExtensionNotInstalled(error)) throw new FreighterExtensionNotInstalledError();
  throw error;
}

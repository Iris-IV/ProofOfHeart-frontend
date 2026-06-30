/**
 * Detects whether an error from Freighter's signTransaction represents
 * the user rejecting/cancelling the signature request, rather than a
 * genuine technical failure.
 */

export class UserCancelledError extends Error {
  constructor() {
    super("Transaction cancelled");
    this.name = "UserCancelledError";
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

export function isUserRejection(error: unknown): boolean {
  if (!error) return false;
  const msg = typeof error === "string" ? error : ((error as Error).message ?? "");
  const lower = msg.toLowerCase();
  return CANCEL_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

export function wrapFreighterError(error: unknown): never {
  if (isUserRejection(error)) {
    throw new UserCancelledError();
  }
  throw error;
}

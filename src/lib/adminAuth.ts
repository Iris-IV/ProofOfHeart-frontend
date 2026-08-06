/**
 * Shared vocabulary for authenticating platform-admin requests to the
 * off-chain API routes.
 *
 * The browser holds the only copy of the admin's private key, so the server
 * cannot issue a session it controls. Instead the caller proves ownership of
 * the address by signing a short-lived, request-bound challenge, and the route
 * checks that the proven address is the platform admin recorded on-chain.
 *
 * Both sides build the challenge with `buildAdminChallenge` so the bytes the
 * wallet signs are exactly the bytes the route verifies.
 *
 * Replay window — known and accepted. The challenge carries a client timestamp
 * rather than a server-issued nonce, so anyone who can observe a request may
 * repeat that exact method and path until the timestamp ages out (see
 * `ADMIN_CHALLENGE_MAX_AGE_MS`). The client deliberately widens the exposure by
 * reusing one signature for a run of actions, see `adminLog.ts`. For an
 * admin-only audit log over HTTPS that trade buys a single wallet prompt per
 * admin session, and the worst case is a replayed read or a duplicate log
 * entry. Guarding anything more consequential with this helper — a mutating
 * admin action, anything with an irreversible effect — needs a server-issued
 * nonce first.
 */

export const ADMIN_ADDRESS_HEADER = "x-stellar-address";
export const ADMIN_TIMESTAMP_HEADER = "x-stellar-timestamp";
export const ADMIN_SIGNATURE_HEADER = "x-stellar-signature";

/**
 * How far a challenge timestamp may sit from the server clock. Wide enough to
 * absorb clock skew and the time the user spends approving a wallet prompt,
 * narrow enough that a captured header set stops working quickly.
 */
export const ADMIN_CHALLENGE_MAX_AGE_MS = 120_000;

export interface AdminChallengeInput {
  address: string;
  /** HTTP method of the request being authorised. */
  method: string;
  /** Path of the request being authorised, e.g. "/api/admin-audit-log". */
  path: string;
  /** Unix epoch milliseconds. */
  timestamp: number;
}

/**
 * The exact string a wallet signs. Binding the method and path means a
 * signature captured from a read cannot be replayed against a write.
 */
export function buildAdminChallenge({
  address,
  method,
  path,
  timestamp,
}: AdminChallengeInput): string {
  return [
    "ProofOfHeart admin request",
    `address: ${address.trim().toUpperCase()}`,
    `method: ${method.toUpperCase()}`,
    `path: ${path}`,
    `timestamp: ${timestamp}`,
  ].join("\n");
}

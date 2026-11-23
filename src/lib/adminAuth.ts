import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { NextResponse } from "next/server";

/**
 * Authorization for admin and creator actions in API routes (#1801–#1804).
 *
 * A caller is identified by a signature from its own key, never by an address it supplies in a header
 * or query string (an address is public, so anyone can copy it). The client signs a message that binds
 * the HTTP method, the path, a timestamp and a nonce, and sends these headers:
 *
 *   x-actor-address    G... public key of the signer
 *   x-actor-timestamp  time the request was signed, in Unix milliseconds
 *   x-actor-nonce      random string, unique per request (replay protection)
 *   x-actor-signature  base64 ed25519 signature over signedRequestMessage(...)
 */

export const SIGNED_REQUEST_WINDOW_MS = 5 * 60_000;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Nonces seen within the window. Process-local, so a multi-instance deployment should move this to the
 * shared store. Until then, the timestamp window still bounds replays to other instances.
 */
const seenNonces = new Map<string, number>();

export function signedRequestMessage(method: string, pathname: string, timestamp: string, nonce: string): string {
  return `ProofOfHeart request\n${method.toUpperCase()}\n${pathname}\n${timestamp}\n${nonce}`;
}

function pruneNonces(now: number): void {
  for (const [key, seenAt] of seenNonces) {
    if (now - seenAt > SIGNED_REQUEST_WINDOW_MS) seenNonces.delete(key);
  }
}

/** Returns the signer's address when the request carries a valid, fresh, unused signature; otherwise null. */
export async function verifySignedActor(req: Request): Promise<string | null> {
  const address = req.headers.get("x-actor-address")?.trim() ?? "";
  const signature = req.headers.get("x-actor-signature") ?? "";
  const timestamp = req.headers.get("x-actor-timestamp") ?? "";
  const nonce = req.headers.get("x-actor-nonce") ?? "";
  if (!address || !signature || !timestamp || !nonce) return null;
  if (!StrKey.isValidEd25519PublicKey(address)) return null;
  if (!NONCE_PATTERN.test(nonce)) return null;

  const now = Date.now();
  const signedAt = Number(timestamp);
  if (!Number.isFinite(signedAt) || Math.abs(now - signedAt) > SIGNED_REQUEST_WINDOW_MS) return null;

  const pathname = new URL(req.url).pathname;
  const message = signedRequestMessage(req.method, pathname, timestamp, nonce);
  let valid = false;
  try {
    valid = Keypair.fromPublicKey(address).verify(Buffer.from(message, "utf8"), Buffer.from(signature, "base64"));
  } catch {
    valid = false;
  }
  if (!valid) return null;

  // Only a valid signature consumes a nonce, so forged requests cannot exhaust the store.
  pruneNonces(now);
  const nonceKey = `${address}:${nonce}`;
  if (seenNonces.has(nonceKey)) return null;
  seenNonces.set(nonceKey, now);
  return address;
}

function normalizeAddress(address: string): string {
  return address.trim().toUpperCase();
}

/** True when `address` is the platform admin, from PLATFORM_ADMIN_ADDRESS or the contract's `get_admin`. */
export async function isPlatformAdmin(address: string): Promise<boolean> {
  try {
    const adminFromEnv = process.env.PLATFORM_ADMIN_ADDRESS?.trim();
    if (adminFromEnv && normalizeAddress(address) === normalizeAddress(adminFromEnv)) return true;
    const { getAdmin } = await import("@/lib/contractClient");
    const onChainAdmin = await getAdmin().catch(() => null);
    if (onChainAdmin && normalizeAddress(address) === normalizeAddress(onChainAdmin)) return true;
  } catch {
    // Admin check is best-effort: on any failure we fall through to the
    // "not admin" result so the caller still sees a stable boolean.
  }
  return false;
}

export type AuthResult =
  | { ok: true; address: string }
  | { ok: false; response: NextResponse };

/** Requires a signed request from the platform admin. */
export async function requireAdmin(req: Request): Promise<AuthResult> {
  const address = await verifySignedActor(req);
  if (!address) {
    return { ok: false, response: NextResponse.json({ error: "Signed admin request required" }, { status: 401 }) };
  }
  if (!(await isPlatformAdmin(address))) {
    return { ok: false, response: NextResponse.json({ error: "Not authorized — admin only" }, { status: 403 }) };
  }
  return { ok: true, address };
}

/** Requires a signed request from the campaign's creator or the platform admin. */
export async function requireCreatorOrAdmin(req: Request, creator: string | null | undefined): Promise<AuthResult> {
  const address = await verifySignedActor(req);
  if (!address) {
    return { ok: false, response: NextResponse.json({ error: "Signed request required" }, { status: 401 }) };
  }
  const isCreator = !!creator && normalizeAddress(address) === normalizeAddress(creator);
  if (!isCreator && !(await isPlatformAdmin(address))) {
    return { ok: false, response: NextResponse.json({ error: "Not authorized — creator or admin only" }, { status: 403 }) };
  }
  return { ok: true, address };
}

import * as StellarSdk from "@stellar/stellar-sdk";
import { NextResponse } from "next/server";
import {
  ADMIN_ADDRESS_HEADER,
  ADMIN_CHALLENGE_MAX_AGE_MS,
  ADMIN_SIGNATURE_HEADER,
  ADMIN_TIMESTAMP_HEADER,
  buildAdminChallenge,
} from "../adminAuth";
import { isSameAddress } from "../stellar";
import { getPlatformAdminAddress } from "./platformAdmin";

export type AdminAuthResult = { ok: true; address: string } | { ok: false; response: NextResponse };

function deny(status: number, error: string): AdminAuthResult {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * Verifies an ed25519 signature over `challenge` against a Stellar account.
 *
 * Freighter hashes the message before signing while a raw keypair signs the
 * bytes directly, so both forms are accepted. Either way the signature is only
 * producible by the holder of the account's secret key.
 */
function verifyChallengeSignature(
  address: string,
  challenge: string,
  signatureBase64: string,
): boolean {
  let keypair: StellarSdk.Keypair;
  try {
    keypair = StellarSdk.Keypair.fromPublicKey(address);
  } catch {
    return false;
  }

  let signature: Buffer;
  try {
    signature = Buffer.from(signatureBase64, "base64");
  } catch {
    return false;
  }
  if (signature.length === 0) return false;

  const raw = Buffer.from(challenge, "utf8");
  try {
    return keypair.verify(raw, signature) || keypair.verify(StellarSdk.hash(raw), signature);
  } catch {
    return false;
  }
}

/**
 * Gate for routes that expose platform-admin data.
 *
 * The caller must present the address it claims plus a signature over a
 * timestamped, request-bound challenge for that address. Only once the
 * signature checks out is the address compared against the platform admin, so
 * naming the admin address — which is public, it is readable from the
 * contract — is not enough to get in.
 *
 * Every failure path denies. If the admin address cannot be resolved the
 * request is refused rather than allowed through.
 */
export async function requirePlatformAdmin(request: Request): Promise<AdminAuthResult> {
  const address = request.headers.get(ADMIN_ADDRESS_HEADER)?.trim() ?? "";
  const timestampHeader = request.headers.get(ADMIN_TIMESTAMP_HEADER)?.trim() ?? "";
  const signature = request.headers.get(ADMIN_SIGNATURE_HEADER)?.trim() ?? "";

  if (!address || !timestampHeader || !signature) {
    return deny(401, "Admin authentication required.");
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) {
    return deny(401, "Invalid authentication timestamp.");
  }
  if (Math.abs(Date.now() - timestamp) > ADMIN_CHALLENGE_MAX_AGE_MS) {
    return deny(401, "Authentication challenge expired.");
  }

  const challenge = buildAdminChallenge({
    address,
    method: request.method,
    path: new URL(request.url).pathname,
    timestamp,
  });

  if (!verifyChallengeSignature(address, challenge, signature)) {
    return deny(401, "Invalid authentication signature.");
  }

  let adminAddress: string;
  try {
    adminAddress = await getPlatformAdminAddress();
  } catch {
    return deny(503, "Unable to verify platform admin.");
  }

  if (!isSameAddress(address, adminAddress)) {
    return deny(403, "Caller is not the platform admin.");
  }

  return { ok: true, address };
}

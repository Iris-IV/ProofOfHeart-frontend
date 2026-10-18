import { StrKey } from "@stellar/stellar-sdk";

export function formatAddress(addr: string, opts?: { head?: number; tail?: number }): string {
  const head = opts?.head ?? 6;
  const tail = opts?.tail ?? 4;
  if (!addr) return "";
  // Already shorter than head + tail: show it as-is instead of duplicating chars
  if (addr.length <= head + tail) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

/**
 * True when `addr` is a valid Stellar ed25519 public key (`G...`) — correct
 * length, prefix, and StrKey checksum (not just a prefix/length check).
 */
export function isEd25519PublicKey(addr: string): boolean {
  return typeof addr === "string" && StrKey.isValidEd25519PublicKey(addr.trim());
}

/**
 * True when `addr` is a valid Soroban contract address (`C...`) with a valid
 * StrKey checksum.
 */
export function isContractAddress(addr: string): boolean {
  return typeof addr === "string" && StrKey.isValidContract(addr.trim());
}

/**
 * True when `addr` is either a valid account (`G...`) or contract (`C...`)
 * address. Use this for input forms that accept both kinds of address.
 */
export function isValidStellarAddress(addr: string): boolean {
  return isEd25519PublicKey(addr) || isContractAddress(addr);
}

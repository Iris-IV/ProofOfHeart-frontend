/**
 * Normalizes a Stellar address by trimming whitespace and converting to uppercase.
 * Stellar addresses (ED25519 public keys) are base32 and conventionally uppercase.
 */
export function normalizeAddress(address: string | null | undefined): string {
  if (!address) return '';
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

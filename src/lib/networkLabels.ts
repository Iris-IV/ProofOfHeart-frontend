/**
 * Human-readable names for the Stellar network passphrases this app may run on.
 *
 * Matching is exact. Substring checks such as `includes("Test SDF")` cannot tell
 * Testnet from Futurenet, because both passphrases contain "Test SDF". Keep the
 * map keyed by the full passphrase.
 */
const NETWORK_LABELS: Readonly<Record<string, string>> = {
  "Public Global Stellar Network ; September 2015": "Mainnet",
  "Test SDF Network ; September 2015": "Testnet",
  "Test SDF Future Network ; October 2022": "Futurenet",
};

/** Label used when a passphrase is empty or not one of the known networks. */
export const UNKNOWN_NETWORK_LABEL = "the app network";

/** Returns the network name for a passphrase, or `null` when it is not recognised. */
export function getNetworkLabel(passphrase: string | null | undefined): string | null {
  if (!passphrase) return null;
  return NETWORK_LABELS[passphrase] ?? null;
}

/** Returns the network name for a passphrase, falling back to a generic phrase. */
export function describeNetwork(passphrase: string | null | undefined): string {
  return getNetworkLabel(passphrase) ?? UNKNOWN_NETWORK_LABEL;
}

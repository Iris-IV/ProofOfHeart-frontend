/**
 * Contract upgrade / ABI-mismatch detection (issue #1118).
 *
 * If the on-chain contract is redeployed with a changed interface, a
 * client that still has the old build cached (service worker, stale tab)
 * could keep calling it with outdated argument shapes. This compares a
 * fingerprint of the contract's WASM hash against the one this build was
 * compiled against, and flags a mismatch so the UI can warn the user to
 * refresh instead of silently failing (or worse, submitting a malformed
 * transaction).
 */

const CACHE_KEY = "poh_contract_wasm_hash";

/** The WASM hash this build expects, injected at build time. */
export function getExpectedContractHash(): string | null {
  return process.env.NEXT_PUBLIC_CONTRACT_WASM_HASH ?? null;
}

/** Persist the last-known-good hash so we can detect a change across visits. */
export function cacheContractHash(hash: string): void {
  try {
    window.localStorage.setItem(CACHE_KEY, hash);
  } catch {
    // Storage unavailable (private mode, disabled) — non-fatal, just skip caching.
  }
}

function getCachedContractHash(): string | null {
  try {
    return window.localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

export interface ContractVersionCheck {
  mismatch: boolean;
  expectedHash: string | null;
  liveHash: string;
}

/**
 * Compare the live on-chain WASM hash (fetched by the caller, e.g. via
 * `rpc.getContractData`/`getLedgerEntries` for the contract's executable)
 * against what this build expects and what was last seen cached. Returns
 * `mismatch: true` the first time the live hash disagrees with either, so
 * the UI can prompt the user to reload before submitting a transaction.
 */
export function checkContractVersion(liveHash: string): ContractVersionCheck {
  const expectedHash = getExpectedContractHash();
  const cachedHash = getCachedContractHash();
  const baseline = cachedHash ?? expectedHash;

  const mismatch = baseline !== null && baseline !== liveHash;
  if (!mismatch) {
    cacheContractHash(liveHash);
  }

  return { mismatch, expectedHash, liveHash };
}

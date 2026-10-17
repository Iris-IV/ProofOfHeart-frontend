import { getAddress, signTransaction } from "@stellar/freighter-api";
import { normalizeContractError } from "../utils/contractErrors";

/**
 * The single place that decides *how* a transaction gets signed.
 *
 * #649 — Before social login existed, `contractClient` and `offchainApiClient`
 * imported Freighter's `signTransaction` directly, which hard-coded a browser
 * extension into every write path. Users arriving without a Web3 wallet had no
 * way through. This indirection lets an embedded wallet derived from a Google or
 * X account satisfy the same contract, so the call sites stay wallet-agnostic.
 *
 * There is exactly one active signer at a time — the app has a single "connected
 * wallet" concept — and it is module state rather than React state because the
 * transaction clients are plain modules called from outside the component tree.
 */

export type WalletKind = "freighter" | "social";

export interface WalletSigner {
  kind: WalletKind;
  /** The Stellar public key (G…) transactions will be signed for. */
  getAddress(): Promise<string>;
  /** Sign a transaction envelope, returning the signed XDR. */
  signTransaction(xdr: string, options: { networkPassphrase: string }): Promise<string>;
}

/**
 * The default. Preserves the original behaviour exactly, so nothing changes for
 * users who already have the extension — including the case where the app is
 * loaded with no wallet connected at all.
 */
export const freighterSigner: WalletSigner = {
  kind: "freighter",
  async getAddress() {
    const { address } = await getAddress();
    return address;
  },
  async signTransaction(xdr, options) {
    const { signedTxXdr } = await signTransaction(xdr, options);
    return signedTxXdr;
  },
};

let activeSigner: WalletSigner = freighterSigner;

/**
 * Install the signer for the connected wallet. Passing `null` reverts to
 * Freighter, which is what disconnecting should do.
 */
export function setActiveWalletSigner(signer: WalletSigner | null): void {
  activeSigner = signer ?? freighterSigner;
}

export function getActiveWalletSigner(): WalletSigner {
  return activeSigner;
}

export function getActiveWalletKind(): WalletKind {
  return activeSigner.kind;
}

// ---------------------------------------------------------------------------
// Transient-failure retries (#1525)
//
// Wallet RPC round-trips (Freighter's bridge, embedded-wallet relays) fail
// transiently far more often than the contract itself does: connection resets,
// gateway 502/503s, and RPC rate limits. Those are safe to retry — the
// operation is idempotent until a transaction is actually signed and submitted,
// and no state is mutated client-side. Deterministic failures (the user
// rejecting the prompt, a malformed envelope, a Soroban revert) are NOT
// retried; retrying them would either re-prompt the user or loop pointlessly.
// ---------------------------------------------------------------------------

/** Number of automatic retries after the initial attempt. */
export const MAX_TRANSIENT_RETRIES = 3;

/** Base backoff; each retry doubles it (300 ms, 600 ms, 1200 ms). */
const DEFAULT_RETRY_BASE_DELAY_MS = 300;

const RETRYABLE_ERROR_PATTERNS = [
  "fetch failed",
  "failed to fetch",
  "network error",
  "networkerror",
  "load failed",
  "socket hang up",
  "econnrefused",
  "econnreset",
  "econnaborted",
  "epipe",
  "etimedout",
  "enotfound",
  "eai_again",
  "timeout",
  "timed out",
  "aborted",
  "rate limit",
  "too many requests",
  "temporarily unavailable",
  "service unavailable",
  "bad gateway",
  "gateway timeout",
];

const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * True when a failure looks like a transient transport/RPC problem that is
 * worth retrying. Walks the `cause` chain because SDKs commonly wrap the
 * underlying syscall error one or two levels deep.
 */
export function isTransientNetworkError(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current === "object" && current !== null) {
      const value = current as Record<string, unknown>;

      for (const status of [value.status, value.statusCode]) {
        if (typeof status === "number" && RETRYABLE_HTTP_STATUS.has(status)) return true;
      }

      if (typeof value.code === "string") {
        const code = value.code.toLowerCase();
        if (RETRYABLE_ERROR_PATTERNS.includes(code)) return true;
      }
      if (typeof value.code === "number" && RETRYABLE_HTTP_STATUS.has(value.code)) return true;

      if (value.name === "AbortError" || value.name === "TimeoutError") return true;
    }

    const message =
      current instanceof Error
        ? current.message.toLowerCase()
        : typeof current === "string"
          ? current.toLowerCase()
          : "";
    if (RETRYABLE_ERROR_PATTERNS.some((pattern) => message.includes(pattern))) return true;

    current = current instanceof Error ? current.cause : null;
  }

  return false;
}

export interface TransientRetryOptions {
  /** Retries after the initial attempt. Default: MAX_TRANSIENT_RETRIES (3). */
  retries?: number;
  /** Base backoff in ms; doubles on each subsequent retry. Default: 300. */
  baseDelayMs?: number;
  /** Invoked before each retry, for metrics/logging. */
  onRetry?: (attempt: number, error: unknown) => void;
  /** Injectable delay, for tests. Defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `operation`, retrying transient network failures up to `retries` times
 * with exponential backoff. On final failure the error is normalized so
 * Soroban revert codes surface as typed contract errors rather than raw SDK
 * strings; anything else propagates unchanged (e.g. user rejection).
 */
export async function withTransientRetry<T>(
  operation: () => Promise<T>,
  options: TransientRetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? MAX_TRANSIENT_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientNetworkError(error) || attempt >= retries) {
        break;
      }

      options.onRetry?.(attempt + 1, error);
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }

  throw normalizeContractError(lastError, "Wallet could not complete the request.");
}

/**
 * Address of the wallet that will sign — use instead of Freighter's `getAddress`.
 * Transient network failures are retried automatically.
 */
export function getSignerAddress(): Promise<string> {
  return withTransientRetry(() => activeSigner.getAddress());
}

/**
 * Sign a transaction envelope with the active wallet. Transient network
 * failures are retried automatically; user cancellations and contract reverts
 * fail fast.
 */
export function signTransactionXdr(
  xdr: string,
  options: { networkPassphrase: string },
): Promise<string> {
  return withTransientRetry(() => activeSigner.signTransaction(xdr, options));
}

/**
 * Common interface that every Stellar wallet adapter must implement.
 *
 * Each adapter wraps one concrete wallet (Freighter, LOBSTR, xBull, …) and
 * exposes a uniform API so the rest of the application never has to care about
 * which wallet is active.
 */
export interface WalletAdapter {
  /** Stable identifier used for persistence (e.g. localStorage key). */
  readonly id: WalletId;

  /** Human-readable wallet name shown in the UI. */
  readonly name: string;

  /**
   * URL of the wallet's install page.  Shown to users who don't yet have the
   * extension installed.
   */
  readonly installUrl: string;

  /**
   * Returns `true` when the wallet extension (or injected global) is present
   * in the current browser environment.
   */
  isAvailable(): boolean;

  /**
   * Returns `true` when the extension is already connected/allowed for this
   * origin.  Used to silently restore a previous session on page load.
   */
  isConnected(): Promise<boolean>;

  /**
   * Triggers the wallet's authorisation / permission flow and resolves with
   * the user's Stellar public key on success.
   *
   * @throws if the user rejects the permission request or the wallet is
   * unavailable.
   */
  connect(): Promise<string>;

  /**
   * Signs a Stellar transaction XDR and returns the signed XDR string.
   *
   * @param xdr           Base64-encoded transaction envelope XDR.
   * @param networkPassphrase  Stellar network passphrase.
   * @returns Signed XDR string (base64-encoded transaction envelope).
   * @throws {@link UserCancelledError} when the user rejects the signature.
   */
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>;

  /**
   * Returns the public key that is currently active in the wallet.
   * May be called after `connect()` to refresh the address, e.g. when the
   * user switches accounts.
   *
   * @throws if the wallet is not connected or unavailable.
   */
  getPublicKey(): Promise<string>;
}

// ---------------------------------------------------------------------------
// Supported wallet IDs
// ---------------------------------------------------------------------------

export type WalletId = "freighter" | "lobstr" | "xbull";

export interface WalletDescriptor {
  id: WalletId;
  name: string;
  description: string;
  installUrl: string;
  /** Emoji or short icon used in the selection modal. */
  icon: string;
}

export const WALLET_DESCRIPTORS: Record<WalletId, WalletDescriptor> = {
  freighter: {
    id: "freighter",
    name: "Freighter",
    description: "Browser extension by Stellar Development Foundation",
    installUrl: "https://www.freighter.app/",
    icon: "🚀",
  },
  lobstr: {
    id: "lobstr",
    name: "LOBSTR",
    description: "Mobile wallet with browser signer extension",
    installUrl: "https://lobstr.co/signer-extension/",
    icon: "🦞",
  },
  xbull: {
    id: "xbull",
    name: "xBull",
    description: "Powerful browser extension & PWA wallet",
    installUrl: "https://xbull.app/",
    icon: "🐂",
  },
};

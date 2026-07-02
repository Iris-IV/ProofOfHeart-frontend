/**
 * WalletAdapter — a common interface for all supported Stellar browser wallets.
 *
 * Each adapter wraps one wallet extension's native API so the rest of the app
 * never imports Freighter, LOBSTR, or xBull directly — only this interface.
 *
 * Supported wallets
 * ─────────────────
 *  • Freighter  (@stellar/freighter-api)
 *  • LOBSTR     (@lobstrco/signer-extension-api)
 *  • xBull      (@creit.tech/xbull-wallet-connect — loaded lazily at runtime)
 *  • Mock       (dev / test mode, no extension required)
 */

// ---------------------------------------------------------------------------
// Core interface
// ---------------------------------------------------------------------------

export interface WalletAdapter {
  /** Stable machine identifier — stored in localStorage. */
  readonly id: WalletId;
  /** Human-readable display name. */
  readonly name: string;
  /** URL of the wallet's install page, shown when not installed. */
  readonly installUrl: string;
  /** Emoji or short icon string used in the selection UI. */
  readonly icon: string;

  /**
   * Return true when the wallet extension is present in the browser.
   * Must never throw — catch internally and return false.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Return the user's Stellar public key.
   * Throws if the wallet is not available or the user denies access.
   */
  getAddress(): Promise<string>;

  /**
   * Sign a base64-encoded transaction XDR and return the signed XDR string.
   * Throws `UserCancelledError` if the user rejects, or a generic Error on failure.
   */
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>;

  /**
   * Start polling / watching for wallet account/network changes.
   * The callback fires whenever a change is detected.
   * Safe to call multiple times — replaces the previous watcher.
   */
  watchChanges(onUpdate: () => void): void;

  /** Stop the watcher started by `watchChanges`. */
  stopWatching(): void;
}

export type WalletId = "freighter" | "lobstr" | "xbull" | "mock";

// ---------------------------------------------------------------------------
// UserCancelledError (re-exported so callers don't need freighterErrors)
// ---------------------------------------------------------------------------

export class UserCancelledError extends Error {
  constructor() {
    super("Transaction cancelled");
    this.name = "UserCancelledError";
  }
}

function isUserRejection(error: unknown): boolean {
  if (!error) return false;
  const msg = typeof error === "string" ? error : ((error as Error).message ?? "");
  const lower = msg.toLowerCase();
  return [
    "user declined",
    "user rejected",
    "user cancelled",
    "user canceled",
    "request cancelled",
    "request canceled",
    "denied by user",
  ].some((p) => lower.includes(p));
}

function wrapSignError(error: unknown): never {
  if (isUserRejection(error)) throw new UserCancelledError();
  throw error;
}

// ---------------------------------------------------------------------------
// Freighter adapter
// ---------------------------------------------------------------------------

export class FreighterAdapter implements WalletAdapter {
  readonly id = "freighter" as const;
  readonly name = "Freighter";
  readonly installUrl = "https://www.freighter.app/";
  readonly icon = "🚀";

  private watcher: { stop(): void } | null = null;

  async isAvailable(): Promise<boolean> {
    try {
      const { isConnected } = await import("@stellar/freighter-api");
      const result = await isConnected();
      return result.isConnected;
    } catch {
      return false;
    }
  }

  async getAddress(): Promise<string> {
    const { getAddress } = await import("@stellar/freighter-api");
    const result = await getAddress();
    return result.address;
  }

  async signTransaction(xdr: string, networkPassphrase: string): Promise<string> {
    try {
      const { signTransaction } = await import("@stellar/freighter-api");
      const result = await signTransaction(xdr, { networkPassphrase });
      return result.signedTxXdr;
    } catch (error) {
      wrapSignError(error);
    }
  }

  watchChanges(onUpdate: () => void): void {
    this.stopWatching();
    import("@stellar/freighter-api").then(({ WatchWalletChanges }) => {
      this.watcher = new WatchWalletChanges(1000);
      (this.watcher as unknown as { watch(cb: () => void): void }).watch(onUpdate);
    });
  }

  stopWatching(): void {
    this.watcher?.stop();
    this.watcher = null;
  }
}

// ---------------------------------------------------------------------------
// LOBSTR adapter
// ---------------------------------------------------------------------------

export class LobstrAdapter implements WalletAdapter {
  readonly id = "lobstr" as const;
  readonly name = "LOBSTR";
  readonly installUrl = "https://lobstr.co/uni/";
  readonly icon = "⭐";

  private pollInterval: ReturnType<typeof setInterval> | null = null;

  async isAvailable(): Promise<boolean> {
    try {
      const { isConnected } = await import("@lobstrco/signer-extension-api");
      return await isConnected();
    } catch {
      return false;
    }
  }

  async getAddress(): Promise<string> {
    const { getPublicKey } = await import("@lobstrco/signer-extension-api");
    const key = await getPublicKey();
    if (!key) throw new Error("LOBSTR did not return a public key.");
    return key;
  }

  async signTransaction(xdr: string, _networkPassphrase: string): Promise<string> {
    try {
      const { signTransaction } = await import("@lobstrco/signer-extension-api");
      // LOBSTR returns the signed XDR string directly
      const signedXdr = await signTransaction(xdr);
      if (!signedXdr) throw new Error("LOBSTR did not return a signed transaction.");
      return signedXdr;
    } catch (error) {
      wrapSignError(error);
    }
  }

  watchChanges(onUpdate: () => void): void {
    this.stopWatching();
    // LOBSTR has no push watcher — poll every second for address changes
    let lastKey = "";
    this.pollInterval = setInterval(async () => {
      try {
        const key = await this.getAddress().catch(() => "");
        if (key !== lastKey) {
          lastKey = key;
          onUpdate();
        }
      } catch {
        // ignore poll errors
      }
    }, 1000);
  }

  stopWatching(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

// ---------------------------------------------------------------------------
// xBull adapter
// ---------------------------------------------------------------------------

export class XBullAdapter implements WalletAdapter {
  readonly id = "xbull" as const;
  readonly name = "xBull";
  readonly installUrl = "https://xbull.app/";
  readonly icon = "🐂";

  private pollInterval: ReturnType<typeof setInterval> | null = null;

  async isAvailable(): Promise<boolean> {
    // xBull extension injects window.xBullSDK when installed
    if (typeof window === "undefined") return false;
    return !!(window as unknown as Record<string, unknown>)["xBullSDK"];
  }

  async getAddress(): Promise<string> {
    // Dynamically import to avoid SSR issues — the package uses window internally
    const { xBullWalletConnect } = await import("@creit.tech/xbull-wallet-connect");
    const bridge = new xBullWalletConnect();
    try {
      const publicKey = await bridge.connect();
      return publicKey;
    } finally {
      bridge.closeConnections();
    }
  }

  async signTransaction(xdr: string, networkPassphrase: string): Promise<string> {
    const { xBullWalletConnect } = await import("@creit.tech/xbull-wallet-connect");
    const bridge = new xBullWalletConnect();
    try {
      // bridge.sign() resolves to the signed XDR string directly
      const signedXdr = await bridge.sign({ xdr, network: networkPassphrase });
      return signedXdr as string;
    } catch (error) {
      wrapSignError(error);
    } finally {
      bridge.closeConnections();
    }
  }

  watchChanges(onUpdate: () => void): void {
    this.stopWatching();
    // xBull has no push watcher — poll every second for address changes
    let lastKey = "";
    this.pollInterval = setInterval(async () => {
      try {
        const key = await this.getAddress().catch(() => "");
        if (key !== lastKey) {
          lastKey = key;
          onUpdate();
        }
      } catch {
        // ignore poll errors
      }
    }, 1000);
  }

  stopWatching(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Mock adapter (dev / test mode)
// ---------------------------------------------------------------------------

export class MockAdapter implements WalletAdapter {
  readonly id = "mock" as const;
  readonly name = "Mock Wallet";
  readonly installUrl = "";
  readonly icon = "🧪";

  private mockPublicKey: string;

  constructor(publicKey: string) {
    this.mockPublicKey = publicKey;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getAddress(): Promise<string> {
    return this.mockPublicKey;
  }

  async signTransaction(xdr: string, _networkPassphrase: string): Promise<string> {
    // In mock mode return the XDR unchanged — no real signing occurs
    return xdr;
  }

  watchChanges(_onUpdate: () => void): void {
    // nothing to watch in mock mode
  }

  stopWatching(): void {
    // nothing to stop
  }
}

// ---------------------------------------------------------------------------
// Registry — ordered list of adapters shown in the selection modal
// ---------------------------------------------------------------------------

export const WALLET_ADAPTERS: readonly WalletAdapter[] = [
  new FreighterAdapter(),
  new LobstrAdapter(),
  new XBullAdapter(),
] as const;

import type { WalletAdapter, WalletId } from "./types";

/**
 * Minimal type declaration for the xBull in-page SDK that the extension
 * injects at `window.xBullSDK`.
 *
 * Full docs: https://github.com/Creit-Tech/xBull-Wallet
 */
interface XBullSDK {
  connect(options?: { canRequestPublicKey?: boolean; canRequestSign?: boolean }): Promise<{
    canRequestPublicKey: boolean;
    canRequestSign: boolean;
  }>;
  getPublicKey(): Promise<string>;
  /** Signs a transaction XDR and returns the signed XDR string. */
  signXDR(
    xdr: string,
    options?: { network?: string; publicKey?: string },
  ): Promise<string>;
}

declare global {
  interface Window {
    xBullSDK?: XBullSDK;
  }
}

/**
 * Wallet adapter for the xBull browser extension.
 *
 * xBull injects `window.xBullSDK` when the extension is installed.
 * We call `connect()` to request permissions and `signXDR()` for signing.
 */
export class XBullAdapter implements WalletAdapter {
  readonly id: WalletId = "xbull";
  readonly name = "xBull";
  readonly installUrl = "https://xbull.app/";

  private get sdk(): XBullSDK | undefined {
    if (typeof window === "undefined") return undefined;
    return window.xBullSDK;
  }

  isAvailable(): boolean {
    return typeof window !== "undefined" && !!window.xBullSDK;
  }

  async isConnected(): Promise<boolean> {
    if (!this.sdk) return false;
    try {
      // Attempt to retrieve the public key without triggering a permission
      // prompt.  If the extension is unlocked and already allowed, this
      // resolves; otherwise it throws.
      const pk = await this.sdk.getPublicKey();
      return !!pk;
    } catch {
      return false;
    }
  }

  async connect(): Promise<string> {
    if (!this.sdk) {
      throw new Error("xBull extension is not installed.");
    }
    // Request both read and sign permissions.
    await this.sdk.connect({ canRequestPublicKey: true, canRequestSign: true });

    const publicKey = await this.sdk.getPublicKey();
    if (!publicKey) {
      throw new Error("xBull did not return a public key. Please allow access and try again.");
    }
    return publicKey;
  }

  async getPublicKey(): Promise<string> {
    if (!this.sdk) {
      throw new Error("xBull extension is not installed.");
    }
    const publicKey = await this.sdk.getPublicKey();
    if (!publicKey) {
      throw new Error("Could not retrieve public key from xBull.");
    }
    return publicKey;
  }

  async signTransaction(xdr: string, networkPassphrase: string): Promise<string> {
    if (!this.sdk) {
      throw new Error("xBull extension is not installed.");
    }
    const signedXdr = await this.sdk.signXDR(xdr, { network: networkPassphrase });
    if (!signedXdr) {
      throw new Error("xBull did not return a signed transaction.");
    }
    return signedXdr;
  }
}

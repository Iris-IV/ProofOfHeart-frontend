import {
  getPublicKey as lobstrGetPublicKey,
  isConnected as lobstrIsConnected,
  signTransaction as lobstrSignTransaction,
} from "@lobstrco/signer-extension-api";
import type { WalletAdapter, WalletId } from "./types";

/**
 * Wallet adapter for the LOBSTR Signer browser extension.
 *
 * LOBSTR Signer docs: https://github.com/lobstrco/lobstr-browser-signer-extension
 *
 * Note: The LOBSTR API does not require the network passphrase for signing —
 * the extension handles network selection internally.
 */
export class LobstrAdapter implements WalletAdapter {
  readonly id: WalletId = "lobstr";
  readonly name = "LOBSTR";
  readonly installUrl = "https://lobstr.co/signer-extension/";

  isAvailable(): boolean {
    if (typeof window === "undefined") return false;
    // The LOBSTR API is always importable; the extension either responds or
    // returns false from isConnected(). Show it as an option in all browsers.
    return true;
  }

  async isConnected(): Promise<boolean> {
    try {
      return await lobstrIsConnected();
    } catch {
      return false;
    }
  }

  async connect(): Promise<string> {
    const connected = await lobstrIsConnected();
    if (!connected) {
      throw new Error("LOBSTR Signer extension is not installed or not responding.");
    }
    const publicKey = await lobstrGetPublicKey();
    if (!publicKey) {
      throw new Error("LOBSTR did not return a public key. Please allow access and try again.");
    }
    return publicKey;
  }

  async getPublicKey(): Promise<string> {
    const publicKey = await lobstrGetPublicKey();
    if (!publicKey) {
      throw new Error("Could not retrieve public key from LOBSTR.");
    }
    return publicKey;
  }

  async signTransaction(xdr: string, _networkPassphrase: string): Promise<string> {
    // The LOBSTR API only accepts the XDR; network passphrase is managed by
    // the extension itself.
    const signedXdr = await lobstrSignTransaction(xdr);
    if (!signedXdr) {
      throw new Error("LOBSTR did not return a signed transaction.");
    }
    return signedXdr;
  }
}

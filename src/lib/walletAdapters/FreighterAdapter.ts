import {
  isConnected as freighterIsConnected,
  isAllowed,
  getAddress,
  signTransaction as freighterSignTransaction,
} from "@stellar/freighter-api";
import { wrapFreighterError } from "@/utils/freighterErrors";
import type { WalletAdapter, WalletId } from "./types";

/**
 * Wallet adapter for the Freighter browser extension.
 *
 * Freighter API docs: https://docs.freighter.app/docs/guide/usingFreighterWebApp
 */
export class FreighterAdapter implements WalletAdapter {
  readonly id: WalletId = "freighter";
  readonly name = "Freighter";
  readonly installUrl = "https://www.freighter.app/";

  isAvailable(): boolean {
    // Freighter injects itself into window; @stellar/freighter-api guards SSR.
    if (typeof window === "undefined") return false;
    // The API module works regardless – if not installed calls resolve to
    // {isConnected: false}, so we can always call it.  Return true so the
    // modal always shows Freighter as an option.
    return true;
  }

  async isConnected(): Promise<boolean> {
    try {
      const connected = await freighterIsConnected();
      if (!connected.isConnected) return false;
      const allowed = await isAllowed();
      return !!allowed.isAllowed;
    } catch {
      return false;
    }
  }

  async connect(): Promise<string> {
    const connected = await freighterIsConnected();
    if (!connected.isConnected) {
      throw new Error("Freighter extension is not installed.");
    }

    // Trigger the permission dialog by requesting the address; Freighter will
    // prompt the user to allow this site if not already allowed.
    const result = await getAddress();
    if (!result.address) {
      throw new Error("Freighter did not return a public key. Please allow access and try again.");
    }
    return result.address;
  }

  async getPublicKey(): Promise<string> {
    const result = await getAddress();
    if (!result.address) {
      throw new Error("Could not retrieve public key from Freighter.");
    }
    return result.address;
  }

  async signTransaction(xdr: string, networkPassphrase: string): Promise<string> {
    try {
      const result = await freighterSignTransaction(xdr, { networkPassphrase });
      return result.signedTxXdr;
    } catch (error) {
      wrapFreighterError(error);
    }
  }
}

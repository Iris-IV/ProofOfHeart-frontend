import { getAddress, signMessage, signTransaction } from "@stellar/freighter-api";

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
  /**
   * Sign an arbitrary message, returning the base64 ed25519 signature.
   *
   * Used to prove address ownership to the off-chain API routes, which have no
   * session of their own to check.
   */
  signMessage(message: string): Promise<string>;
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
  async signMessage(message) {
    const { signedMessage } = await signMessage(message);
    if (!signedMessage) {
      throw new Error("Freighter returned no signature for the message.");
    }
    // Freighter v3 hands back a Buffer, v4 a base64 string.
    return typeof signedMessage === "string"
      ? signedMessage
      : Buffer.from(signedMessage).toString("base64");
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

/** Address of the wallet that will sign — use instead of Freighter's `getAddress`. */
export function getSignerAddress(): Promise<string> {
  return activeSigner.getAddress();
}

/** Sign a transaction envelope with the active wallet. */
export function signTransactionXdr(
  xdr: string,
  options: { networkPassphrase: string },
): Promise<string> {
  return activeSigner.signTransaction(xdr, options);
}

/** Sign a plain message with the active wallet, returning a base64 signature. */
export function signWalletMessage(message: string): Promise<string> {
  return activeSigner.signMessage(message);
}

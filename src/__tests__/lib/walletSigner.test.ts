/**
 * #649 — The signer indirection that lets Freighter and the embedded social
 * wallet serve the same call sites in `contractClient` / `offchainApiClient`.
 */

import { getAddress, signTransaction } from "@stellar/freighter-api";
import {
  freighterSigner,
  getActiveWalletKind,
  getActiveWalletSigner,
  getSignerAddress,
  setActiveWalletSigner,
  signTransactionXdr,
  type WalletSigner,
} from "@/lib/walletSigner";

// setupTests mocks the module but omits signTransaction, which nothing needed before.
jest.mock("@stellar/freighter-api", () => ({
  isConnected: jest.fn().mockResolvedValue({ isConnected: false }),
  isAllowed: jest.fn().mockResolvedValue({ isAllowed: false }),
  getAddress: jest.fn(),
  getNetwork: jest.fn().mockResolvedValue({ network: "", networkPassphrase: "" }),
  signTransaction: jest.fn(),
}));

const mockGetAddress = getAddress as jest.Mock;
const mockSignTransaction = signTransaction as jest.Mock;

const OPTIONS = { networkPassphrase: "Test SDF Network ; September 2015" };

function fakeSigner(): WalletSigner {
  return {
    kind: "social",
    getAddress: jest.fn().mockResolvedValue("GSOCIAL"),
    signTransaction: jest.fn().mockResolvedValue("social-signed-xdr"),
  };
}

describe("walletSigner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setActiveWalletSigner(null);
  });

  it("defaults to Freighter", () => {
    expect(getActiveWalletSigner()).toBe(freighterSigner);
    expect(getActiveWalletKind()).toBe("freighter");
  });

  it("unwraps Freighter's object responses", async () => {
    mockGetAddress.mockResolvedValue({ address: "GFREIGHTER" });
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "freighter-signed-xdr" });

    await expect(getSignerAddress()).resolves.toBe("GFREIGHTER");
    await expect(signTransactionXdr("raw-xdr", OPTIONS)).resolves.toBe("freighter-signed-xdr");
    expect(mockSignTransaction).toHaveBeenCalledWith("raw-xdr", OPTIONS);
  });

  it("routes signing to the installed signer without touching Freighter", async () => {
    const social = fakeSigner();
    setActiveWalletSigner(social);

    expect(getActiveWalletKind()).toBe("social");
    await expect(getSignerAddress()).resolves.toBe("GSOCIAL");
    await expect(signTransactionXdr("raw-xdr", OPTIONS)).resolves.toBe("social-signed-xdr");

    expect(social.signTransaction).toHaveBeenCalledWith("raw-xdr", OPTIONS);
    expect(mockSignTransaction).not.toHaveBeenCalled();
    expect(mockGetAddress).not.toHaveBeenCalled();
  });

  it("reverts to Freighter when the signer is cleared on disconnect", async () => {
    setActiveWalletSigner(fakeSigner());
    setActiveWalletSigner(null);

    mockSignTransaction.mockResolvedValue({ signedTxXdr: "freighter-signed-xdr" });

    expect(getActiveWalletKind()).toBe("freighter");
    await expect(signTransactionXdr("raw-xdr", OPTIONS)).resolves.toBe("freighter-signed-xdr");
  });

  it("propagates signer rejections so callers can detect user cancellation", async () => {
    const social = fakeSigner();
    (social.signTransaction as jest.Mock).mockRejectedValue(new Error("User rejected"));
    setActiveWalletSigner(social);

    await expect(signTransactionXdr("raw-xdr", OPTIONS)).rejects.toThrow("User rejected");
  });
});

/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks carry no `this`, so passing them to expect() is safe. */
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
  isTransientNetworkError,
  withTransientRetry,
  MAX_TRANSIENT_RETRIES,
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

  describe("transient retries (#1525)", () => {
    it("retries transient signing failures and succeeds", async () => {
      const social = fakeSigner();
      (social.signTransaction as jest.Mock)
        .mockRejectedValueOnce(new Error("fetch failed"))
        .mockRejectedValueOnce(new TypeError("NetworkError"))
        .mockResolvedValueOnce("signed-after-retry");
      setActiveWalletSigner(social);

      await expect(signTransactionXdr("raw-xdr", OPTIONS)).resolves.toBe("signed-after-retry");
      expect(social.signTransaction).toHaveBeenCalledTimes(3);
    });

    it("stops after the retry budget is exhausted", async () => {
      const social = fakeSigner();
      (social.signTransaction as jest.Mock).mockRejectedValue(new Error("econnreset"));
      setActiveWalletSigner(social);

      await expect(signTransactionXdr("raw-xdr", OPTIONS)).rejects.toThrow();
      expect(social.signTransaction).toHaveBeenCalledTimes(MAX_TRANSIENT_RETRIES + 1);
    });

    it("never retries user cancellations", async () => {
      const social = fakeSigner();
      (social.signTransaction as jest.Mock).mockRejectedValue(new Error("User rejected"));
      setActiveWalletSigner(social);

      await expect(signTransactionXdr("raw-xdr", OPTIONS)).rejects.toThrow("User rejected");
      expect(social.signTransaction).toHaveBeenCalledTimes(1);
    });

    it("normalizes embedded Soroban revert codes on failure", async () => {
      const social = fakeSigner();
      (social.signTransaction as jest.Mock).mockRejectedValue(
        new Error("HostError: Error(Contract, #3)"),
      );
      setActiveWalletSigner(social);

      await expect(signTransactionXdr("raw-xdr", OPTIONS)).rejects.toMatchObject({
        name: "ContractErrorException",
        code: 3,
      });
      expect(social.signTransaction).toHaveBeenCalledTimes(1);
    });

    it("retries transient getAddress failures", async () => {
      const social = fakeSigner();
      (social.getAddress as jest.Mock)
        .mockRejectedValueOnce(new Error("429 too many requests"))
        .mockResolvedValueOnce("GSOCIAL");
      setActiveWalletSigner(social);

      await expect(getSignerAddress()).resolves.toBe("GSOCIAL");
      expect(social.getAddress).toHaveBeenCalledTimes(2);
    });
  });
});

describe("isTransientNetworkError", () => {
  it("recognizes transport-level failures by message", () => {
    expect(isTransientNetworkError(new Error("fetch failed"))).toBe(true);
    expect(isTransientNetworkError(new TypeError("NetworkError"))).toBe(true);
    expect(isTransientNetworkError(new Error("socket hang up"))).toBe(true);
  });

  it("recognizes retryable HTTP status codes", () => {
    expect(isTransientNetworkError({ status: 503 })).toBe(true);
    expect(isTransientNetworkError({ statusCode: 429 })).toBe(true);
    expect(isTransientNetworkError({ status: 400 })).toBe(false);
  });

  it("recognizes socket error codes on nested causes", () => {
    const error = new TypeError("fetch failed");
    (error as Error & { cause?: unknown }).cause = { code: "ECONNRESET" };

    expect(isTransientNetworkError(error)).toBe(true);
  });

  it("does not treat user cancellations or contract reverts as transient", () => {
    expect(isTransientNetworkError(new Error("User rejected"))).toBe(false);
    expect(isTransientNetworkError(new Error("Error(Contract, #3)"))).toBe(false);
  });
});

describe("withTransientRetry", () => {
  const noSleep = () => Promise.resolve();

  it("returns immediately on success", async () => {
    const operation = jest.fn().mockResolvedValue("ok");

    await expect(withTransientRetry(operation, { sleep: noSleep })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("backs off and retries transient errors up to the configured limit", async () => {
    const delays: number[] = [];
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValue("ok");

    await expect(
      withTransientRetry(operation, {
        baseDelayMs: 100,
        sleep: (ms) => {
          delays.push(ms);
          return Promise.resolve();
        },
      }),
    ).resolves.toBe("ok");

    expect(operation).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([100, 200]);
  });

  it("does not retry non-transient errors", async () => {
    const operation = jest.fn().mockRejectedValue(new Error("User rejected"));

    await expect(withTransientRetry(operation, { sleep: noSleep })).rejects.toThrow(
      "User rejected",
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("invokes onRetry for each retry attempt", async () => {
    const onRetry = jest.fn();
    const operation = jest.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValue("ok");

    await withTransientRetry(operation, { onRetry, sleep: noSleep });

    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });
});

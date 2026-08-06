/**
 * #649 & #843 — Embedded wallet derivation, social wallet connection, session management,
 * transaction signing, and guards around error/rejection paths.
 */

import * as StellarSdk from "@stellar/stellar-sdk";

type SocialWalletModule = typeof import("@/lib/socialWallet");

const SEED_HEX = "9".repeat(64);

const mockInit = jest.fn();
const mockLogin = jest.fn();
const mockLogout = jest.fn();
const mockGetUserInfo = jest.fn();
let mockEd25519PrivKey: string | undefined = SEED_HEX;
let mockState: { ed25519PrivKey?: string; userInfo?: { authConnection?: string } } = {
  ed25519PrivKey: SEED_HEX,
  userInfo: { authConnection: "google" },
};

jest.mock("@web3auth/auth", () => {
  return {
    Auth: jest.fn().mockImplementation(() => ({
      init: mockInit,
      login: mockLogin,
      logout: mockLogout,
      getUserInfo: mockGetUserInfo,
      get ed25519PrivKey() {
        return mockEd25519PrivKey;
      },
      get state() {
        return mockState;
      },
    })),
    UX_MODE: { POPUP: "popup" },
  };
});

function loadWithClientId(clientId?: string): SocialWalletModule {
  const original = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
  if (clientId === undefined) {
    delete process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
  } else {
    process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID = clientId;
  }

  let mod!: SocialWalletModule;
  jest.isolateModules(() => {
    mod = require("@/lib/socialWallet");
  });

  process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID = original;
  return mod;
}

function buildDummyTxXdr(publicKey: string): string {
  const account = new StellarSdk.Account(publicKey, "100");
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: publicKey,
        asset: StellarSdk.Asset.native(),
        amount: "10",
      }),
    )
    .setTimeout(30)
    .build();
  return tx.toXDR();
}

describe("socialWallet configuration", () => {
  it("is unavailable until a Web3Auth client id is provisioned", () => {
    expect(loadWithClientId(undefined).isSocialLoginConfigured()).toBe(false);
    expect(loadWithClientId("").isSocialLoginConfigured()).toBe(false);
    expect(loadWithClientId("   ").isSocialLoginConfigured()).toBe(false);
    expect(loadWithClientId("BP-client-id").isSocialLoginConfigured()).toBe(true);
  });

  it("restores nothing — and never loads the SDK — when unconfigured", async () => {
    await expect(loadWithClientId(undefined).restoreSocialWallet()).resolves.toBeNull();
  });
});

describe("deriveStellarKeypair", () => {
  const { deriveStellarKeypair } = loadWithClientId("BP-client-id");

  it("derives a Stellar account from a 32-byte seed", () => {
    const keypair = deriveStellarKeypair(SEED_HEX);
    const expected = StellarSdk.Keypair.fromRawEd25519Seed(Buffer.from(SEED_HEX, "hex"));

    expect(keypair.publicKey()).toBe(expected.publicKey());
    expect(keypair.publicKey()).toMatch(/^G[A-Z2-7]{55}$/);
  });

  it("takes the leading seed from the 64-byte expanded key", () => {
    const expanded = SEED_HEX + "a".repeat(64);

    expect(deriveStellarKeypair(expanded).publicKey()).toBe(
      deriveStellarKeypair(SEED_HEX).publicKey(),
    );
  });

  it("accepts a 0x prefix", () => {
    expect(deriveStellarKeypair(`0x${SEED_HEX}`).publicKey()).toBe(
      deriveStellarKeypair(SEED_HEX).publicKey(),
    );
  });

  it("rejects key material of an unexpected length rather than deriving a wrong account", () => {
    expect(() => deriveStellarKeypair("")).toThrow(/unexpected key format/);
    expect(() => deriveStellarKeypair("abcd")).toThrow(/unexpected key format/);
    expect(() => deriveStellarKeypair("f".repeat(96))).toThrow(/unexpected key format/);
  });

  it("rejects key material with invalid non-hex characters resulting in invalid seed length", () => {
    const invalidHex = "g".repeat(64);
    expect(() => deriveStellarKeypair(invalidHex)).toThrow(/unexpected key format/);
  });
});

describe("connectSocialWallet", () => {
  beforeEach(() => {
    mockInit.mockReset().mockResolvedValue(undefined);
    mockLogin.mockReset().mockResolvedValue(undefined);
    mockLogout.mockReset().mockResolvedValue(undefined);
    mockGetUserInfo.mockReset().mockResolvedValue({
      name: "Test User",
      email: "test@example.com",
      profileImage: "https://example.com/avatar.png",
    });
    mockEd25519PrivKey = SEED_HEX;
    mockState = {
      ed25519PrivKey: SEED_HEX,
      userInfo: { authConnection: "google" },
    };
  });

  it("connects successfully and derives wallet session for google provider", async () => {
    const mod = loadWithClientId("BP-client-id");
    const session = await mod.connectSocialWallet("google");

    expect(mockLogin).toHaveBeenCalledWith({ authConnection: "google" });
    expect(session.provider).toBe("google");
    expect(session.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    expect(session.name).toBe("Test User");
    expect(session.email).toBe("test@example.com");
    expect(session.profileImage).toBe("https://example.com/avatar.png");
  });

  it("connects successfully for twitter provider", async () => {
    const mod = loadWithClientId("BP-client-id");
    const session = await mod.connectSocialWallet("twitter");

    expect(mockLogin).toHaveBeenCalledWith({ authConnection: "twitter" });
    expect(session.provider).toBe("twitter");
  });

  it("throws error when social login is not configured", async () => {
    const mod = loadWithClientId(undefined);
    await expect(mod.connectSocialWallet("google")).rejects.toThrow(
      "Social login is not configured. Set NEXT_PUBLIC_WEB3AUTH_CLIENT_ID.",
    );
  });

  it("throws error when Web3Auth returns no ed25519 key", async () => {
    mockEd25519PrivKey = undefined;
    const mod = loadWithClientId("BP-client-id");
    await expect(mod.connectSocialWallet("google")).rejects.toThrow(
      "Social login did not return a wallet key.",
    );
  });

  it("handles profile fetch failure gracefully and still returns session", async () => {
    mockGetUserInfo.mockRejectedValue(new Error("Network error fetching user profile"));
    const mod = loadWithClientId("BP-client-id");

    const session = await mod.connectSocialWallet("google");
    expect(session.provider).toBe("google");
    expect(session.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    expect(session.name).toBeUndefined();
    expect(session.email).toBeUndefined();
  });

  it("resets initPromise on Auth.init rejection to allow retry", async () => {
    mockInit.mockRejectedValueOnce(new Error("Web3Auth init failed"));
    const mod = loadWithClientId("BP-client-id");

    await expect(mod.connectSocialWallet("google")).rejects.toThrow("Web3Auth init failed");

    mockInit.mockResolvedValueOnce(undefined);
    const session = await mod.connectSocialWallet("google");
    expect(session.provider).toBe("google");
  });
});

describe("restoreSocialWallet", () => {
  beforeEach(() => {
    mockInit.mockReset().mockResolvedValue(undefined);
    mockLogin.mockReset().mockResolvedValue(undefined);
    mockLogout.mockReset().mockResolvedValue(undefined);
    mockGetUserInfo.mockReset().mockResolvedValue({
      name: "Restored User",
      email: "restored@example.com",
    });
    mockEd25519PrivKey = SEED_HEX;
    mockState = {
      ed25519PrivKey: SEED_HEX,
      userInfo: { authConnection: "twitter" },
    };
  });

  it("returns null when unconfigured", async () => {
    const mod = loadWithClientId(undefined);
    expect(await mod.restoreSocialWallet()).toBeNull();
  });

  it("returns in-memory session if already connected", async () => {
    const mod = loadWithClientId("BP-client-id");
    const connectedSession = await mod.connectSocialWallet("google");
    const restoredSession = await mod.restoreSocialWallet();

    expect(restoredSession).toBe(connectedSession);
  });

  it("rehydrates session from Web3Auth state when present", async () => {
    const mod = loadWithClientId("BP-client-id");
    const restoredSession = await mod.restoreSocialWallet();

    expect(restoredSession).not.toBeNull();
    expect(restoredSession?.provider).toBe("twitter");
    expect(restoredSession?.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    expect(restoredSession?.name).toBe("Restored User");
  });

  it("returns null when Web3Auth state has no ed25519PrivKey", async () => {
    mockState = {};
    const mod = loadWithClientId("BP-client-id");
    expect(await mod.restoreSocialWallet()).toBeNull();
  });

  it("returns null gracefully when getAuth throws an error", async () => {
    mockInit.mockRejectedValue(new Error("Init failed during restore"));
    const mod = loadWithClientId("BP-client-id");
    expect(await mod.restoreSocialWallet()).toBeNull();
  });
});

describe("disconnectSocialWallet", () => {
  beforeEach(() => {
    mockInit.mockReset().mockResolvedValue(undefined);
    mockLogout.mockReset().mockResolvedValue(undefined);
    mockEd25519PrivKey = SEED_HEX;
    mockState = { ed25519PrivKey: SEED_HEX };
  });

  it("disconnecting is safe when no session was ever established", async () => {
    const mod = loadWithClientId("BP-client-id");
    await expect(mod.disconnectSocialWallet()).resolves.toBeUndefined();
  });

  it("clears session and keypair and invokes auth logout", async () => {
    const mod = loadWithClientId("BP-client-id");
    await mod.connectSocialWallet("google");

    await mod.disconnectSocialWallet();

    expect(mockLogout).toHaveBeenCalled();
    await expect(mod.socialSigner.getAddress()).rejects.toThrow("Social wallet is not connected.");
  });

  it("handles auth.logout error gracefully without throwing to caller", async () => {
    mockLogout.mockRejectedValue(new Error("Remote logout failed"));
    const mod = loadWithClientId("BP-client-id");
    await mod.connectSocialWallet("google");

    await expect(mod.disconnectSocialWallet()).resolves.toBeUndefined();
    await expect(mod.socialSigner.getAddress()).rejects.toThrow("Social wallet is not connected.");
  });
});

describe("socialSigner", () => {
  beforeEach(() => {
    mockInit.mockReset().mockResolvedValue(undefined);
    mockLogin.mockReset().mockResolvedValue(undefined);
    mockEd25519PrivKey = SEED_HEX;
    mockState = { ed25519PrivKey: SEED_HEX };
  });

  it("identifies itself as the social wallet kind", () => {
    expect(loadWithClientId("BP-client-id").socialSigner.kind).toBe("social");
  });

  it("refuses to sign or report an address before connection", async () => {
    const mod = loadWithClientId("BP-client-id");

    await expect(mod.socialSigner.getAddress()).rejects.toThrow("Social wallet is not connected.");
    await expect(
      mod.socialSigner.signTransaction("xdr", {
        networkPassphrase: StellarSdk.Networks.TESTNET,
      }),
    ).rejects.toThrow("Social wallet is not connected.");
  });

  it("returns public key when connected", async () => {
    const mod = loadWithClientId("BP-client-id");
    const session = await mod.connectSocialWallet("google");

    const address = await mod.socialSigner.getAddress();
    expect(address).toBe(session.publicKey);
  });

  it("signs transaction XDR when connected", async () => {
    const mod = loadWithClientId("BP-client-id");
    const session = await mod.connectSocialWallet("google");

    const rawTxXdr = buildDummyTxXdr(session.publicKey);
    const signedXdr = await mod.socialSigner.signTransaction(rawTxXdr, {
      networkPassphrase: StellarSdk.Networks.TESTNET,
    });

    expect(typeof signedXdr).toBe("string");
    expect(signedXdr).not.toBe(rawTxXdr);

    const parsedTx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, StellarSdk.Networks.TESTNET);
    expect(parsedTx.signatures.length).toBe(1);
  });
});

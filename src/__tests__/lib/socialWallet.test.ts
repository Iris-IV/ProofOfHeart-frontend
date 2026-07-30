/**
 * #649 — Embedded wallet derivation and the guards around it.
 *
 * The Web3Auth SDK is never loaded here: `getAuth()` only `import()`s it once a
 * client id is configured, so the unconfigured paths exercised below stay
 * entirely local.
 */

import * as StellarSdk from "@stellar/stellar-sdk";

type SocialWalletModule = typeof import("@/lib/socialWallet");

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

const SEED_HEX = "9".repeat(64);

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
    // Web3Auth returns seed ‖ publicKey in some key modes; both encodings must
    // resolve to the same Stellar account or a user's address would change
    // between sessions.
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
});

describe("socialSigner", () => {
  it("refuses to sign or report an address before connection", async () => {
    const mod = loadWithClientId("BP-client-id");

    await expect(mod.socialSigner.getAddress()).rejects.toThrow("Social wallet is not connected.");
    await expect(
      mod.socialSigner.signTransaction("xdr", {
        networkPassphrase: "Test SDF Network ; September 2015",
      }),
    ).rejects.toThrow("Social wallet is not connected.");
  });

  it("identifies itself as the social wallet kind", () => {
    expect(loadWithClientId("BP-client-id").socialSigner.kind).toBe("social");
  });

  it("disconnecting is safe when no session was ever established", async () => {
    await expect(
      loadWithClientId("BP-client-id").disconnectSocialWallet(),
    ).resolves.toBeUndefined();
  });
});

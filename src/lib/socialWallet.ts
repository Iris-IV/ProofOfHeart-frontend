import * as StellarSdk from "@stellar/stellar-sdk";
import type { WalletSigner } from "@/lib/walletSigner";

/**
 * Embedded Stellar wallet backed by a social account (#649).
 *
 * New users without a browser extension previously hit a hard wall at
 * "Connect Wallet". Web3Auth's MPC network turns a Google or X sign-in into a
 * deterministic ed25519 key, which is exactly the curve Stellar uses — so the
 * key it returns *is* a Stellar account, with no custodial bridge in between.
 *
 * Two properties are load-bearing:
 *
 * - **The SDK is only ever `import()`ed.** `@web3auth/auth` pulls in ~40
 *   packages that no visitor needs unless they choose social login, so it must
 *   stay out of the initial bundle (same reasoning as #657).
 * - **The secret key never leaves memory.** It is re-derived from Web3Auth's own
 *   session on reload rather than persisted, so no code path can write a signing
 *   key to `localStorage`.
 */

/** The providers named in #649. Web3Auth supports more; these are the ones we surface. */
export type SocialLoginProvider = "google" | "twitter";

export interface SocialWalletSession {
  provider: SocialLoginProvider;
  publicKey: string;
  name?: string;
  email?: string;
  profileImage?: string;
}

const CLIENT_ID = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
const NETWORK_OVERRIDE = process.env.NEXT_PUBLIC_WEB3AUTH_NETWORK;
const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK;

/** Minimal structural type for the lazily imported `Auth` instance. */
type AuthInstance = {
  init(): Promise<void>;
  login(params: { authConnection: string; mfaLevel?: string }): Promise<unknown>;
  logout(): Promise<void>;
  getUserInfo(): Promise<{ name?: string; email?: string; profileImage?: string }>;
  readonly ed25519PrivKey: string;
  state: { ed25519PrivKey?: string; userInfo?: { authConnection?: string } };
};

let authInstance: AuthInstance | null = null;
let initPromise: Promise<AuthInstance> | null = null;
/** Held in memory only, for the lifetime of the tab. Never serialised. */
let keypair: StellarSdk.Keypair | null = null;
let session: SocialWalletSession | null = null;

/**
 * Whether social login can be offered. False unless an operator has provisioned
 * a Web3Auth client id, which keeps the buttons hidden rather than broken.
 */
export function isSocialLoginConfigured(): boolean {
  return typeof CLIENT_ID === "string" && CLIENT_ID.trim().length > 0;
}

/**
 * Web3Auth key shares are namespaced per network, so this must track the Stellar
 * network: pointing mainnet users at the devnet share set would derive different
 * — and unfunded — accounts.
 */
function resolveWeb3AuthNetwork(): string {
  const override = NETWORK_OVERRIDE?.trim();
  if (override) return override;
  return STELLAR_NETWORK === "mainnet" ? "sapphire_mainnet" : "sapphire_devnet";
}

async function getAuth(): Promise<AuthInstance> {
  if (authInstance) return authInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (typeof window === "undefined") {
      throw new Error("Social login is only available in the browser.");
    }
    if (!CLIENT_ID) {
      throw new Error("Social login is not configured. Set NEXT_PUBLIC_WEB3AUTH_CLIENT_ID.");
    }

    const { Auth, UX_MODE } = await import("@web3auth/auth");
    const instance = new Auth({
      clientId: CLIENT_ID,
      network: resolveWeb3AuthNetwork() as never,
      // A popup keeps the user on the page. Redirect mode would drop them back on
      // an arbitrary route and lose any in-progress contribution form.
      uxMode: UX_MODE.POPUP,
      redirectUrl: window.location.origin,
    }) as unknown as AuthInstance;

    await instance.init();
    authInstance = instance;
    return instance;
  })();

  try {
    return await initPromise;
  } catch (error) {
    // Allow a later attempt to retry initialisation rather than resolving the
    // same rejected promise forever.
    initPromise = null;
    throw error;
  }
}

/**
 * Turn Web3Auth's ed25519 material into a Stellar keypair.
 *
 * The SDK returns either the 32-byte seed or the 64-byte expanded secret key
 * (seed ‖ public key) depending on the key mode in use. Stellar wants the seed,
 * which is the leading 32 bytes in both encodings.
 */
export function deriveStellarKeypair(hex: string): StellarSdk.Keypair {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (normalized.length !== 64 && normalized.length !== 128) {
    throw new Error("Social login returned an unexpected key format.");
  }
  const seed = Buffer.from(normalized.slice(0, 64), "hex");
  if (seed.length !== 32) {
    throw new Error("Social login returned an unexpected key format.");
  }
  return StellarSdk.Keypair.fromRawEd25519Seed(seed);
}

function providerFromAuthConnection(value: string | undefined): SocialLoginProvider {
  return value === "twitter" ? "twitter" : "google";
}

async function buildSession(
  auth: AuthInstance,
  provider: SocialLoginProvider,
): Promise<SocialWalletSession> {
  const privKey = auth.ed25519PrivKey;
  if (!privKey) {
    throw new Error("Social login did not return a wallet key.");
  }

  keypair = deriveStellarKeypair(privKey);

  let profile: { name?: string; email?: string; profileImage?: string } = {};
  try {
    profile = await auth.getUserInfo();
  } catch {
    // Profile details are cosmetic — a failure here must not block the wallet.
  }

  session = {
    provider,
    publicKey: keypair.publicKey(),
    name: profile.name,
    email: profile.email,
    profileImage: profile.profileImage,
  };
  return session;
}

/** Start the social login popup and derive the embedded wallet. */
export async function connectSocialWallet(
  provider: SocialLoginProvider,
): Promise<SocialWalletSession> {
  const auth = await getAuth();
  await auth.login({ authConnection: provider });
  return buildSession(auth, provider);
}

/**
 * Rehydrate a previous social session on page load, or return null when there
 * is none. Never opens a popup, so it is safe to call on mount.
 */
export async function restoreSocialWallet(): Promise<SocialWalletSession | null> {
  if (!isSocialLoginConfigured()) return null;
  if (session) return session;

  try {
    const auth = await getAuth();
    if (!auth.state?.ed25519PrivKey) return null;
    return await buildSession(
      auth,
      providerFromAuthConnection(auth.state.userInfo?.authConnection),
    );
  } catch {
    // A corrupt or expired session should look identical to "not logged in".
    return null;
  }
}

export async function disconnectSocialWallet(): Promise<void> {
  keypair = null;
  session = null;
  if (!authInstance) return;
  try {
    await authInstance.logout();
  } catch {
    // Local state is already cleared; a failed remote logout must not surface
    // as a failed disconnect.
  }
}

/**
 * Signer for the embedded wallet.
 *
 * Signing happens locally with the in-memory keypair — there is no extension to
 * prompt, so the transaction is signed the moment it is submitted. Callers get
 * the same `WalletSigner` contract as Freighter.
 */
export const socialSigner: WalletSigner = {
  kind: "social",
  async getAddress() {
    if (!keypair) throw new Error("Social wallet is not connected.");
    return keypair.publicKey();
  },
  async signTransaction(xdr, { networkPassphrase }) {
    if (!keypair) throw new Error("Social wallet is not connected.");
    const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);
    tx.sign(keypair);
    return tx.toXDR();
  },
};

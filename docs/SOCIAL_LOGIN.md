# Social Login & Embedded Wallets

Google and X sign-in that provisions a real Stellar wallet, so visitors without a browser
extension can contribute (#649).

## Why Web3Auth

Stellar signs with ed25519. Web3Auth's MPC network derives a deterministic ed25519 key
from a social login, so the key it returns **is** a Stellar account — no custodial bridge,
no server holding funds. Privy was the alternative named in the issue but has no Stellar
support.

The integration uses [`@web3auth/auth`](https://www.npmjs.com/package/@web3auth/auth), the
core SDK, rather than `@web3auth/modal`. The modal package declares peer dependencies on
`viem`, `@solana/kit` and `@coinbase/wallet-sdk` — an EVM/Solana tree of no use to a
Stellar app. The core SDK still runs the whole OAuth redirect itself and exposes
`ed25519PrivKey` directly.

## Architecture

```
WalletContext ──▶ connectWithSocial(provider)
                        │
                        ▼
             socialWallet.ts  ── dynamic import("@web3auth/auth")
                        │       derives StellarSdk.Keypair from ed25519PrivKey
                        ▼
             walletSigner.ts  ── setActiveWalletSigner(socialSigner)
                        ▲
                        │  signTransactionXdr() / getSignerAddress()
        contractClient.ts, offchainApiClient.ts
```

[`walletSigner.ts`](../src/lib/walletSigner.ts) is the load-bearing piece. Before it, the
transaction clients imported Freighter's `signTransaction` directly, hard-coding a browser
extension into every write path. They now call through a one-signer-at-a-time indirection
that Freighter and the embedded wallet both satisfy. It is module state rather than React
state because the clients are plain modules called from outside the component tree.

## Two properties worth preserving

**The SDK is only ever `import()`ed.** `@web3auth/auth` pulls in ~40 packages that no
visitor needs unless they choose social login, so it must stay out of the initial bundle —
the same reasoning as [third-party scripts](./THIRD_PARTY_SCRIPTS.md).

**The secret key never leaves memory.** It is held in a module variable for the lifetime of
the tab and re-derived from Web3Auth's own session on reload. No code path writes a signing
key to `localStorage`, and `disconnectWallet()` clears it before the remote logout is even
issued.

## Configuration

```bash
# From https://dashboard.web3auth.io — unset hides the social buttons entirely
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=

# Optional. Defaults to sapphire_devnet on testnet, sapphire_mainnet on mainnet.
NEXT_PUBLIC_WEB3AUTH_NETWORK=
```

Register your deployment's origin as a redirect URL in the Web3Auth dashboard, and enable
the Google and X connections there.

Without a client id, `isSocialLoginConfigured()` is false, `SocialLoginButtons` renders
nothing, and the app behaves exactly as it did before: Freighter only. That is the default
so an unprovisioned deployment shows the unchanged flow rather than buttons that fail on
click.

The Web3Auth network is pinned to the Stellar network because key shares are namespaced per
network — pointing mainnet users at the devnet share set would derive different, unfunded
accounts.

## User-facing flow

1. Visitor clicks **Connect Wallet**.
2. No Freighter extension is detected, so the connect modal opens.
3. The modal offers "Install Freighter" _and_ "Continue with Google / X".
4. Choosing a social provider opens a popup (not a redirect, which would drop the user on
   an arbitrary route and lose any in-progress contribution form).
5. On success the embedded wallet becomes the active signer, and the navbar shows the
   account name instead of a truncated `G…` address.

Signing is local, so social users see no wallet prompt — the transaction is signed the
moment it is submitted.

## Notes for maintainers

- The Freighter connection poll in `WalletContext` runs every 5 seconds and would tear
  down a social session the moment it saw the extension reporting "not connected". A ref
  guard (`isSocialSessionRef`) prevents that; keep it in mind when touching that effect.
- Connecting Freighter explicitly supersedes a social session and hands the signer back.
- A newly created embedded wallet is unfunded. Stellar requires a minimum balance before
  the account exists on-chain, so a first-time social user still needs XLM before they can
  transact. Surfacing that in the UI is not yet done.
- Extending `WalletContextType` breaks any test that builds the context literal — see
  `src/__tests__/components/RevenueSharingPanel.test.tsx`.

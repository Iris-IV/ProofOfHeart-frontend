# ProofOfHeart

**A decentralized launchpad where the community — not a corporation — validates a cause.**

ProofOfHeart is a Next.js frontend for community-driven fundraising on the Stellar
network. Campaigns, contributions, refunds, revenue sharing and comment moderation
are anchored in a Soroban smart contract; the frontend is a wallet-connected UI over
that contract. All on-chain interactions are signed by the user's Freighter wallet —
the frontend never holds private keys.

The smart contract lives in a separate repository:
[**Iris-IV/ProofOfHeart-stellar**](https://github.com/Iris-IV/ProofOfHeart-stellar).

---

## Prerequisites

| Tool                                                  | Version     | Notes                                              |
| ----------------------------------------------------- | ----------- | -------------------------------------------------- |
| [Node.js](https://nodejs.org/)                        | `>= 22`     | Enforced via `engines` in `package.json`           |
| npm                                                   | `>= 10`     | Ships with Node 22                                 |
| [Freighter](https://www.freighter.app/)               | latest      | Browser wallet used to sign transactions           |
| Git                                                   | any recent  |                                                    |

No Freighter wallet is needed to run the app in mock mode — it is only required for
real testnet/mainnet transactions.

---

## Quick start (mock mode)

Mock mode runs the whole UI against deterministic in-repo data. It needs no contract
address, no RPC access and no wallet.

```bash
# 1. Install dependencies from the lockfile
npm ci

# 2. Create your local environment file
cp .env.example .env.local

# 3. Make sure mock mode is on in .env.local
#    NEXT_PUBLIC_USE_MOCKS=true

# 4. Start the dev server
npm run dev
```

Open <http://localhost:3000>. The app boots with mock campaigns, contributions and
comments.

`NEXT_PUBLIC_USE_MOCKS=true` (already the default in `.env.example`) is the only
variable required for this path.

---

## Running against Stellar testnet

To talk to a deployed contract instead of mocks, set `NEXT_PUBLIC_USE_MOCKS=false`
and fill in the contract coordinates in `.env.local`:

```env
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_CONTRACT_ADDRESS=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

- `NEXT_PUBLIC_CONTRACT_ADDRESS` — the deployed ProofOfHeart contract (`C…`).
- `NEXT_PUBLIC_SOROBAN_RPC_URL` — Soroban RPC endpoint (public testnet by default).
- `NEXT_PUBLIC_NETWORK_PASSPHRASE` — must match the network of the RPC endpoint.
  Testnet uses `Test SDF Network ; September 2015`; mainnet uses
  `Public Global Stellar Network ; September 2015`.

Some features (mainnet RPC with an API key, analytics, IPFS uploads, social login,
fiat on-ramp) need extra variables. Every variable is documented in
[`docs/ENVIRONMENT_VARIABLES.md`](docs/ENVIRONMENT_VARIABLES.md) and declared in
[`src/lib/envContract.ts`](src/lib/envContract.ts).

---

## Scripts

| Command              | What it does                                                        |
| -------------------- | ------------------------------------------------------------------- |
| `npm run dev`        | Start the Next.js dev server at <http://localhost:3000>             |
| `npm run build`      | Production build (runs the production-build validator first)        |
| `npm run start`      | Serve a production build                                            |
| `npm run lint`       | Run ESLint across the repo                                          |
| `npm run typecheck`  | Type-check with `tsc --noEmit`                                      |
| `npm test`           | Run the Jest unit/integration suite                                 |
| `npm run test:watch` | Run Jest in watch mode                                              |
| `npm run test:e2e`   | Run the Playwright end-to-end suite (mock mode)                     |
| `npm run storybook`  | Start Storybook on <http://localhost:6006>                          |
| `npm run format`     | Format the repo with Prettier                                       |

See `package.json` for the full list (coverage, bundle-size, audit, changesets, …).

---

## Project structure

```
src/
├── app/          Next.js App Router pages, layouts and route handlers (api/)
├── components/   Reusable React UI components
├── hooks/        Data-fetching and lifecycle hooks (useCampaign, …)
├── lib/          Framework-agnostic logic: contract client, stores, env, SEO,
│                 feature flags, persistence adapters
├── context/      React context providers (wallet, donations, …)
├── i18n/         Locale routing and helpers
├── types/        Shared TypeScript types
└── __tests__/    Jest test suites, mirroring the source tree
messages/         next-intl translation catalogs (en.json, es.json)
docs/             Developer and operations documentation
```

---

## Testing

Unit and integration tests use Jest + React Testing Library:

```bash
npm test
```

End-to-end tests use Playwright. They boot the dev server with
`NEXT_PUBLIC_USE_MOCKS=true` so they run against deterministic mock campaign data:

```bash
npm run test:e2e
```

Playwright defaults are intentionally conservative: headless in CI with a reduced
browser matrix, no screenshot noise from animations, and no artifact retention in
local runs.

---

## Documentation

- [`docs/`](docs/) — architecture, API reference, environment variables, deployment,
  security, design system and operations guides.
- [`docs/CONTRACT_INTEGRATION.md`](docs/CONTRACT_INTEGRATION.md) — frontend ↔ contract
  architecture and function mapping.
- [`docs/api.md`](docs/api.md) — API route reference.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — local setup, workflow and pre-PR checks.
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — community expectations.

---

## Campaign display currencies

Campaign cards and detail pages offer an XLM/USD/EUR selector for the funding
target. Fiat values are approximate display values from CoinGecko, refreshed
every minute while selected; donations and contract amounts remain in XLM.
The server caches quotes for 60 seconds and rejects invalid quotes or prices
older than ten minutes. If the provider is unavailable or rate limited, the XLM
target stays visible and supporters can retry. No provider key is required and
wallet addresses are never sent to the quote provider.

## Campaign hook split

Campaign data fetching is separated into focused hooks so each query is easier to
reason about and test:

- `useCampaign` owns the base fetch lifecycle and shared loading/error state.
- `useCampaignMetadata` exposes title, description, tags and creator metadata.
- `useCampaignFunding` exposes funding totals, milestones and percentage calculations.
- `useCampaignRules` exposes lifecycle and contribution gating behavior.

This keeps one source of truth for data loading while avoiding a single monolithic
hook with unrelated responsibilities.

Campaign detail pages also show the latest 20 contributions received while the
page is open. The scrollable feed shares the funding subscription, deduplicates
replayed events, and pauses network activity when the tab is hidden. Pausing the
feed freezes its visible entries while funding totals continue to update;
resuming shows the latest entries. Mock mode displays an explicit notice instead
of simulated donations. Connection failures retain existing entries while the
subscription retries.

## Logging utilities

Shared local-storage log helpers centralize read/write, timestamping and
address-based filtering for wallet/admin log features. This reduces duplication and
keeps persistence behavior consistent across entries.

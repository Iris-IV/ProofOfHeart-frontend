# Frontend ↔ Contract Integration Architecture

> **Contract repo:** [Iris-IV/ProofOfHeart-stellar](https://github.com/Iris-IV/ProofOfHeart-stellar)
> **Contract version:** `1` (`CONTRACT_VERSION` constant in `src/lib.rs`)
> **SDK:** `soroban-sdk = "20.1.0"`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Flow Diagram](#2-data-flow-diagram)
3. [Environment Variables](#3-environment-variables)
4. [Frontend Layer Map](#4-frontend-layer-map)
5. [Contract Function → Frontend Flow Mapping](#5-contract-function--frontend-flow-mapping)
6. [Type Mapping: Rust Structs ↔ TypeScript Interfaces](#6-type-mapping-rust-structs--typescript-interfaces)
7. [Error Code Reference](#7-error-code-reference)
8. [Contract Events](#8-contract-events)
9. [Testing: Testnet vs Mainnet](#9-testing-testnet-vs-mainnet)
10. [Development with Mocks](#10-development-with-mocks)
11. [Adding a New Contract Integration Point](#11-adding-a-new-contract-integration-point)

---

## 1. Architecture Overview

ProofOfHeart is a Next.js 16 frontend that connects to a Soroban smart contract on the Stellar network. All on-chain interactions are signed by the user's **Freighter** browser wallet — the frontend never holds private keys.

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                     │
│                                                         │
│  Pages / Components                                     │
│       │                                                 │
│  React Hooks  (useCampaigns, useCampaign)               │
│       │                                                 │
│  Contract Client  (src/lib/contractClient.ts)           │
│       │                                                 │
│  Error Layer  (src/utils/contractErrors.ts)             │
└──────────────────────┬──────────────────────────────────┘
                       │  HTTPS / JSON-RPC
                       ▼
            ┌─────────────────────┐
            │   Soroban RPC Node  │
            │  (testnet / mainnet)│
            └──────────┬──────────┘
                       │  XDR
                       ▼
            ┌─────────────────────┐
            │  Stellar Ledger     │
            │  ProofOfHeart       │
            │  Smart Contract     │
            └─────────────────────┘
                       ▲
                       │  sign transaction
            ┌──────────┴──────────┐
            │  Freighter Wallet   │
            │  (browser extension)│
            └─────────────────────┘
```

Wallet connection is handled separately via `@stellar/freighter-api`. The wallet signs transactions that the contract client builds; it never sends raw keys to the frontend.

---

## 2. Data Flow Diagram

### Read flow (e.g. loading a campaign page)

```
/causes/[id]  page
     │
     ▼
useCampaign(id)  hook
     │  calls
     ▼
getCampaign(id)  ── contractClient.ts ──►  Soroban RPC  get_campaign(id)
     │                                          │
     │  Campaign struct (XDR decoded)           │
     ◄──────────────────────────────────────────┘
     │
     ▼
Campaign  TypeScript object  →  rendered to DOM
```

### Write flow (e.g. contributing to a campaign)

```
User clicks "Contribute"
     │
     ▼
Page calls  contribute(campaignId, amount)  ── contractClient.ts
     │
     ▼
Build Soroban transaction  (contribute, campaign_id, contributor, amount)
     │
     ▼
Request signature  ──►  Freighter Wallet  (user approves)
     │
     ▼
Submit signed XDR  ──►  Soroban RPC  ──►  Ledger
     │
     ├─ success ──►  showSuccess() toast  +  optimistic UI update
     └─ error   ──►  parseContractError(err)  ──►  showError() toast
```

---

## 3. Environment Variables

Create a `.env.local` file in the project root. All `NEXT_PUBLIC_` variables are
exposed to the browser bundle; never put secrets in them.

```env
# ─── Development ────────────────────────────────────────────────────────────

# Set to "true" to serve mock campaign data instead of querying the contract.
# Required while the live contract client (issue #14) is not yet wired up.
NEXT_PUBLIC_USE_MOCKS=true

# ─── Contract (required when NEXT_PUBLIC_USE_MOCKS=false) ───────────────────

# The deployed contract ID (C… address, 56 chars)
NEXT_PUBLIC_CONTRACT_ID=

# The Soroban-compatible token contract used for contributions
NEXT_PUBLIC_TOKEN_CONTRACT_ID=

# ─── Network ────────────────────────────────────────────────────────────────

# Soroban RPC endpoint
# Testnet:  https://soroban-testnet.stellar.org
# Mainnet:  https://mainnet.stellar.validationcloud.io/v1/<API_KEY>
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org

# "testnet" | "mainnet" | "futurenet"
NEXT_PUBLIC_STELLAR_NETWORK=testnet

# Network passphrase (used when building transactions)
# Testnet:  Test SDF Network ; September 2015
# Mainnet:  Public Global Stellar Network ; September 2015
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

> **Never commit `.env.local`** — it is already in `.gitignore`.
> Commit `.env.local.example` (already in the repo) to keep the list up to date.

---

## 4. Frontend Layer Map

```
src/
├── lib/
│   └── contractClient.ts       ← single integration point for all contract calls
│                                  swap mock ↔ live by toggling NEXT_PUBLIC_USE_MOCKS
├── hooks/
│   ├── useCampaigns.ts         ← fetch all campaigns (loading / error / refetch)
│   └── useCampaign.ts          ← fetch one campaign by id (loading / error / notFound)
├── utils/
│   └── contractErrors.ts       ← ContractError enum, errorMessages, parseContractError()
├── components/
│   ├── ToastProvider.tsx        ← global toast context + useToast() hook
│   ├── WalletContext.tsx        ← Freighter wallet state (publicKey, connect, disconnect)
│   └── WalletConnection.tsx    ← wallet connect/disconnect UI widget
└── types/
    └── index.ts                ← Campaign TypeScript interface (contract-aligned)
```

**Rule:** pages and components never call the Soroban RPC directly. They go through
`contractClient.ts` → hooks. This means wiring up the real contract only requires
editing `contractClient.ts`.

---

## 5. Contract Function → Frontend Flow Mapping

### Read functions

| Contract function | `contractClient.ts` wrapper | Hook | Page / Component |
|---|---|---|---|
| `get_campaign(campaign_id)` | `getCampaign(id)` | `useCampaign(id)` | `/causes/[id]`, `/explore` |
| `get_campaign` × N | `getAllCampaigns()` | `useCampaigns()` | `/causes`, `/explore` |
| `get_campaign_count()` | `getCampaignCount()` | (internal) | — |
| `get_contribution(campaign_id, contributor)` | `getContribution(campaignId, contributor)` | `useContribution(...)`, `useRevenueSharing(...)` | `/causes/[id]` (contributor view), `/dashboard` |
| `get_revenue_pool(campaign_id)` | `getRevenuePool(campaignId)` | `useRevenueSharing(...)` | `/causes/[id]`, `/dashboard` |
| `get_revenue_claimed(campaign_id, contributor)` | `getRevenueClaimed(campaignId, contributor)` | `useRevenueSharing(...)` | `/causes/[id]`, `/dashboard` |
| `get_approve_votes(campaign_id)` | _pending_ | _pending_ | `/causes/[id]` (community vote UI) |
| `get_reject_votes(campaign_id)` | _pending_ | _pending_ | `/causes/[id]` (community vote UI) |
| `has_voted(campaign_id, voter)` | _pending_ | _pending_ | `/causes/[id]` (community vote UI) |
| `get_version()` | _pending_ | — | admin / debug |

### Write functions

| Contract function | Parameters | Frontend flow | Page / Component | Auth required |
|---|---|---|---|---|
| `create_campaign` | `creator, title, description, funding_goal, duration_days, category, has_revenue_sharing, revenue_share_percentage` | Cause submission form | `/causes/new` _(planned)_ | Creator wallet |
| `contribute` | `campaign_id, contributor, amount` | Donation flow | `/causes/[id]` | Contributor wallet |
| `withdraw_funds` | `campaign_id` | Creator withdrawal | `/causes/[id]` (creator view) | Creator wallet |
| `cancel_campaign` | `campaign_id` | Campaign cancellation | `/causes/[id]` (creator view) | Creator wallet |
| `claim_refund` | `campaign_id, contributor` | Refund claiming | `/causes/[id]` (contributor view) | Contributor wallet |
| `deposit_revenue` | `campaign_id, amount` | Revenue deposit | `/dashboard`, `/causes/[id]` (creator view) | Creator wallet |
| `claim_revenue` | `campaign_id, contributor` | Revenue claim | `/causes/[id]` (contributor view) | Contributor wallet |
| `vote_on_campaign` | `campaign_id, voter, approve` | Community validation vote | `/causes/[id]` (voting panel) | Token-holding wallet |
| `verify_campaign` | `campaign_id` | Admin verification | `/admin` _(planned)_ | Admin wallet only |
| `verify_campaign_with_votes` | `campaign_id` | Trigger vote-based verification | `/causes/[id]` | Anyone |

### Business rules to enforce on the frontend (before calling the contract)

| Rule | Contract error if violated |
|---|---|
| Contributor ≠ campaign creator | `NotAuthorized (1)` |
| Campaign must be active and not cancelled | `CampaignNotActive (3)` |
| `amount > 0` for contribute / deposit_revenue | `ContributionMustBePositive (9)` |
| `funding_goal > 0` when creating | `FundingGoalMustBePositive (4)` |
| `duration_days` between 1 and 365 | `InvalidDuration (5)` |
| `revenue_share_percentage` 1–5000 bps (0.01%–50%) | `InvalidRevenueShare (6)` |
| Revenue sharing only for `EducationalStartup` campaigns | `RevenueShareOnlyForStartup (7)` |
| `withdraw_funds` only after goal reached | `FundingGoalNotReached (12)` |
| Funds not already withdrawn | `FundsAlreadyWithdrawn (11)` |
| Refund only after cancel or deadline passed + goal not met | `ValidationFailed (15)` |
| Voter must hold the platform token | `NotTokenHolder (17)` |
| Each wallet can only vote once per campaign | `AlreadyVoted (16)` |

---

## 6. Type Mapping: Rust Structs ↔ TypeScript Interfaces

### Campaign

```
Rust (lib.rs)                          TypeScript (src/types/index.ts)
─────────────────────────────────────  ──────────────────────────────────────────
pub struct Campaign {                  export interface Campaign {
  pub id: u32,                ──────►    id: number;
  pub creator: Address,       ──────►    creator: string;        // G… address
  pub title: String,          ──────►    title: string;
  pub description: String,    ──────►    description: string;
  pub funding_goal: i128,     ──────►    targetAmount: number;   // ⚠ see note 1
  pub deadline: u64,          ──────►    createdAt: number;      // ⚠ see note 2
  pub amount_raised: i128,    ──────►    currentAmount: number;  // ⚠ see note 1
  pub is_active: bool,        ──────►    status: 'pending'|'approved'|'rejected'; // note 3
  pub is_cancelled: bool,     ──┐
  pub is_verified: bool,      ──┘
  pub funds_withdrawn: bool,  ──────►    funds_withdrawn: boolean;
  pub category: Category,     ──────►    category: Category;     // ⚠ see note 4
  pub has_revenue_sharing: bool,──────►  has_revenue_sharing: boolean;
  pub revenue_share_percentage: u32,──►  revenue_share_percentage: number;
  // no upvotes/downvotes/totalVotes     upvotes: number;        // ⚠ see note 5
}                                        downvotes: number;
                                         totalVotes: number;
                                       }
```

> **Note 1 — amounts:** The contract stores amounts as `i128` **stroops**
> (1 XLM = 10,000,000 stroops). The current TypeScript type uses plain `number`
> in XLM units. When the real client is wired up, convert:
> `xlm = Number(stroops) / 10_000_000`.

> **Note 2 — timestamps:** The TypeScript `createdAt` field stores the creation
> Unix timestamp (seconds). The contract stores `deadline` (not creation time).
> Creation time should be recorded when `create_campaign` is called
> (`env.ledger().timestamp()` in Rust). The TypeScript type will need a
> `deadline: number` field added alongside `createdAt`.

> **Note 3 — status derivation:** The contract has no single `status` field.
> Derive it from boolean flags:
> ```ts
> function deriveStatus(c: RawCampaign): Campaign['status'] {
>   if (c.is_cancelled) return 'rejected';
>   if (c.is_verified)  return 'approved';
>   return 'pending';
> }
> ```

> **Note 4 — Category enum:** The contract uses a Rust enum. Map it to a string:
> ```ts
> const CATEGORY_LABELS: Record<number, string> = {
>   0: 'learner',
>   1: 'startup',
>   2: 'educator',
>   3: 'publisher',
> };
> ```

> **Note 5 — votes:** `upvotes` / `downvotes` / `totalVotes` in the TypeScript type
> come from the community voting system (`vote_on_campaign`), not from the campaign
> struct itself. They map to `get_approve_votes` + `get_reject_votes` view calls.

### Category enum

```
Rust                         TypeScript (add to src/types/index.ts)
────────────────────────     ──────────────────────────────────────
pub enum Category {          export enum CampaignCategory {
  Learner = 0,      ──────►    Learner           = 0,
  EducationalStartup = 1, ─►   EducationalStartup = 1,
  Educator = 2,     ──────►    Educator           = 2,
  Publisher = 3,    ──────►    Publisher          = 3,
}                            }
```

---

## 7. Error Code Reference

The contract returns error codes when operations fail. The frontend maps every code
to a user-friendly message via `src/utils/contractErrors.ts`.

| Code | `ContractError` enum value | User-facing message | Typical trigger |
|---|---|---|---|
| 1 | `NotAuthorized` | You are not authorized to perform this action. | Creator trying to contribute to own campaign |
| 2 | `CampaignNotFound` | This campaign could not be found. | Invalid campaign ID |
| 3 | `CampaignNotActive` | This campaign is no longer accepting contributions. | Cancelled or deadline-passed campaign |
| 4 | `FundingGoalMustBePositive` | The funding goal must be greater than zero. | `funding_goal ≤ 0` on create |
| 5 | `InvalidDuration` | The campaign duration is invalid. | `duration_days` outside 1–365 |
| 6 | `InvalidRevenueShare` | The revenue share percentage is invalid. | bps outside 1–5000 |
| 7 | `RevenueShareOnlyForStartup` | Revenue sharing is only available for startup campaigns. | Revenue flag set on non-startup |
| 8 | `DeadlinePassed` | The campaign deadline has passed. | Contribution after deadline |
| 9 | `ContributionMustBePositive` | Please enter a valid contribution amount. | `amount ≤ 0` |
| 10 | `DeadlineNotPassed` | The campaign deadline has not passed yet. | Attempted refund before deadline |
| 11 | `FundsAlreadyWithdrawn` | The funds for this campaign have already been withdrawn. | Double-withdraw attempt |
| 12 | `FundingGoalNotReached` | The funding goal has not been reached yet. | Withdraw before goal met |
| 13 | `NoFundsToWithdraw` | There are no funds available to withdraw. | Zero balance refund / revenue claim |
| 14 | `CampaignAlreadyVerified` | This campaign has already been verified. | Re-verifying |
| 15 | `ValidationFailed` | Validation failed. Please check your input and try again. | General input guard |
| 16 | `AlreadyVoted` | You have already voted on this campaign. | Duplicate vote attempt |
| 17 | `NotTokenHolder` | You must hold the platform token to vote. | Voter has 0 token balance |
| 18 | `VotingQuorumNotMet` | Not enough votes have been cast yet. | `verify_campaign_with_votes` before quorum |
| 19 | `VotingThresholdNotMet` | The approval threshold has not been reached. | `verify_campaign_with_votes` with < 60% approval |

> **⚠ Action needed:** `src/utils/contractErrors.ts` currently defines codes 1–15 only.
> Codes 16–19 (`AlreadyVoted`, `NotTokenHolder`, `VotingQuorumNotMet`,
> `VotingThresholdNotMet`) must be added before the community voting UI is built.

Error codes surface in two formats from the Soroban SDK:

```
Error(Contract, #3)           ← simulation / preflight error
invokeHostFunctionEntryExpired ← RPC-level error (network / resource)
```

`parseContractError()` in `src/utils/contractErrors.ts` handles both formats and
returns the user-facing string directly — pass any caught error to it before showing
a toast.

---

## 8. Contract Events

The contract emits the following Soroban events. Subscribe to them via the Soroban
RPC event streaming API when building real-time update features.

| Event topic | Data payload | Emitted by |
|---|---|---|
| `("campaign_created", count, creator)` | `title: String` | `create_campaign` |
| `("contribution_made", campaign_id, contributor)` | `amount: i128` | `contribute` |
| `("withdrawal", campaign_id, creator)` | `amount: i128` | `withdraw_funds` |
| `("campaign_cancelled", campaign_id)` | `()` | `cancel_campaign` |
| `("refund_claimed", campaign_id, contributor)` | `amount: i128` | `claim_refund` |
| `("revenue_deposited", campaign_id)` | `amount: i128` | `deposit_revenue` |
| `("revenue_claimed", campaign_id, contributor)` | `amount: i128` | `claim_revenue` |
| `("campaign_vote_cast", campaign_id, voter)` | `approve: bool` | `vote_on_campaign` |
| `("campaign_verified", campaign_id)` | `()` or `approve_votes: u32` | `verify_campaign` / `verify_campaign_with_votes` |
| `("fee_updated",)` | `(old_fee, new_fee): (u32, u32)` | `update_platform_fee` |

---

## 9. Testing: Testnet vs Mainnet

### Testnet (development & staging)

```env
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

- Fund test accounts with Friendbot: `https://friendbot.stellar.org/?addr=<YOUR_ADDRESS>`
- Deploy the contract with Soroban CLI:
  ```bash
  soroban contract deploy \
    --wasm target/wasm32-unknown-unknown/release/proof_of_heart.wasm \
    --source <DEPLOYER_SECRET> \
    --network testnet
  ```
- Initialise after deploy:
  ```bash
  soroban contract invoke \
    --id <CONTRACT_ID> \
    --source <ADMIN_SECRET> \
    --network testnet \
    -- init \
    --admin <ADMIN_ADDRESS> \
    --token <TOKEN_CONTRACT_ID> \
    --platform_fee 300
  ```
  `platform_fee` is in basis points: `300` = 3%.

- Switch Freighter to **Testnet** in the extension settings before testing.
- Copy the deployed `CONTRACT_ID` into `.env.local` and set `NEXT_PUBLIC_USE_MOCKS=false`.

### Mainnet (production)

```env
NEXT_PUBLIC_RPC_URL=https://mainnet.stellar.validationcloud.io/v1/<API_KEY>
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
```

- Deploying to mainnet costs real XLM. Ensure the deployer account is funded.
- Use a hardware wallet or cold-storage key for the admin address.
- Switch Freighter to **Mainnet** before testing end-to-end.
- Set `NEXT_PUBLIC_USE_MOCKS=false` — mock mode must never be enabled in production.

### Switching networks without rebuilding

Because all network config is in environment variables, switching networks only
requires changing `.env.local` (or the platform's env var UI, e.g. Vercel) and
restarting the dev server. No code changes are needed.

---

## 10. Development with Mocks

When `NEXT_PUBLIC_USE_MOCKS=true`, `contractClient.ts` returns the six hardcoded
`MOCK_CAMPAIGNS` array without making any network requests. This lets you work on
UI and component logic without needing a deployed contract or wallet.

```
.env.local  →  NEXT_PUBLIC_USE_MOCKS=true
                   │
                   ▼
          contractClient.ts  returns MOCK_CAMPAIGNS[]
                   │
                   ▼
          useCampaigns() / useCampaign()  ← behave identically to live mode
```

To test error states in mock mode, temporarily modify a `contractClient.ts` function
to `throw new ContractErrorException(ContractError.CampaignNotActive)` — the error
layer and toast system will handle it identically to a real contract error.

---

## 11. Adding a New Contract Integration Point

Follow these steps when wiring up a new contract function (e.g. `contribute`):

1. **Add a `contractClient.ts` function:**
   ```ts
   export async function contribute(
     campaignId: number,
     contributor: string,
     amount: bigint,
   ): Promise<void> {
     if (USE_MOCKS) { /* simulate success */ return; }
     try {
       const client = new ProofOfHeartClient({ contractId: CONTRACT_ID, rpc: RPC_URL });
       await client.contribute({ campaign_id: campaignId, contributor, amount });
     } catch (err) {
       throw new Error(parseContractError(err));
     }
   }
   ```

2. **Create a hook if the call is reactive** (data-fetching):
   ```ts
   // src/hooks/useContribution.ts
   export function useContribution(campaignId: number, contributor: string) { ... }
   ```
   For one-off mutations (contribute, withdraw, etc.) call `contractClient.ts` directly
   from the page/component handler — no hook needed.

3. **Wrap the call in a try/catch using `parseContractError`:**
   ```ts
   const { showError, showSuccess } = useToast();
   try {
     await contribute(campaignId, publicKey, amountInStroops);
     showSuccess('Contribution recorded on-chain.');
   } catch (err) {
     showError(parseContractError(err));
   }
   ```

4. **Guard the action in the UI** based on campaign state to avoid predictable
   contract errors before the transaction is even built (see business rules table in
   section 5).

5. **Update this document** — add the new function to the mapping table in section 5.

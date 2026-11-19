# Frontend ↔ Contract Integration Architecture

> **Contract repo:** [Iris-IV/ProofOfHeart-stellar](https://github.com/Iris-IV/ProofOfHeart-stellar)
> **Contract version:** `1` (`CONTRACT_VERSION` constant in `src/lib.rs`)
> **SDK:** `soroban-sdk = "22.0.11"`

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
# Mainnet: Use server-side proxy at /api/rpc (see MAINNET_RPC_URL in server env)
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
│   ├── contractClient.ts       ← single integration point for all contract calls
│   │                              swap mock ↔ live by toggling NEXT_PUBLIC_USE_MOCKS
│   └── generated/              ← typed read bindings, regenerated from the contract spec
│       ├── contract-spec.json  ← normalized read surface (npm run bindings:generate)
│       ├── client.ts           ← ProofOfHeartGeneratedClient: one method per view entrypoint
│       └── README.md           ← regeneration instructions
├── hooks/
│   ├── useCampaigns.ts         ← fetch all campaigns (loading / error / refetch)
│   └── useCampaign.ts          ← fetch one campaign by id (loading / error / notFound)
├── utils/
│   └── contractErrors.ts       ← ContractError enum, errorMessages, parseContractError()
├── components/
│   ├── ToastProvider.tsx        ← global toast context + useToast() hook
│   └── WalletContext.tsx        ← Freighter wallet state (publicKey, connect, disconnect)
└── types/
    └── index.ts                ← Campaign TypeScript interface (contract-aligned)
```

**Rule:** pages and components never call the Soroban RPC directly. They go through
`contractClient.ts` → hooks. This means wiring up the real contract only requires
editing `contractClient.ts`. Inside it, every **read** is delegated to the
generated client in `src/lib/generated/` (regenerate with `npm run bindings:generate`
after a contract interface change — see `src/lib/generated/README.md`); **writes**
build their invocation directly.

---

## 5. Contract Function → Frontend Flow Mapping

The contract exposes 139 entrypoints. Their canonical reference is the contract
repo's [API.md](https://github.com/Iris-IV/ProofOfHeart-stellar/blob/main/docs/API.md).
The tables below list **every wrapper exported by `contractClient.ts`** — reads
are delegated to the generated client (`src/lib/generated/client.ts`), writes
build the invocation directly. Entrypoints with no wrapper yet (delegation,
multi-token campaign creation, admin configuration, anomaly controls) are
documented in API.md and can be wired up following section 11.

### Read functions

| Contract function                          | `contractClient.ts` wrapper                                     | Generated method        | Hook / Page                                        |
| ------------------------------------------ | --------------------------------------------------------------- | ----------------------- | -------------------------------------------------- |
| `list_campaigns`                           | `listCampaigns({ start, limit, category?, creator? })`, `initialCampaignsCursor(filters)` | `listCampaigns`         | `useCampaigns()`, `useInfiniteCampaigns()` — `/causes`, `/explore` |
| `get_creator_campaigns`                    | `listCampaigns({ creator })`                                    | `getCreatorCampaigns`   | creator listings — `/dashboard`, creator profile   |
| `get_campaigns_by_category`                | `listCampaigns({ category })`                                   | `getCampaignsByCategory` | category filter — `/explore`                       |
| `get_campaign(campaign_id)`                | `getCampaign(id)`                                               | `getCampaign`           | `useCampaign(id)` — `/causes/[id]`, `/explore`     |
| `get_campaign` × N                         | `getAllCampaigns()`                                             | `getCampaign`           | `useCampaigns()` — `/causes`, `/explore`           |
| `get_campaign_count()`                     | `getCampaignCount()`                                            | `getCampaignCount`      | `/explore` header                                  |
| `get_platform_stats()`                     | `getPlatformStats()`                                            | `getPlatformStats`      | `usePlatformStats()` — `/`, `/explore`             |
| `get_contribution(campaign_id, contributor)` | `getContribution(campaignId, contributor)`                    | `getContribution`       | `useContribution(...)`, `useRevenueSharing(...)` — `/causes/[id]`, `/dashboard` |
| `get_personal_cap(campaign_id, contributor)` | `getPersonalCap(campaignId, contributor)`                      | `getPersonalCap`        | `usePersonalCap()` — contribution form             |
| `get_revenue_pool(campaign_id)`            | `getRevenuePool(campaignId)`                                    | `getRevenuePool`        | `useRevenueSharing(...)` — `/causes/[id]`, `/dashboard` |
| `get_revenue_claimed(campaign_id, contributor)` | `getRevenueClaimed(campaignId, contributor)`                | `getRevenueClaimed`     | `useRevenueSharing(...)` — `/causes/[id]`, `/dashboard` |
| `get_milestones(campaign_id)`              | `getMilestones(campaignId)`                                     | `getMilestones`         | milestones section — `/causes/[id]`                |
| `is_milestone_claimed(campaign_id, milestone_id)` | `isMilestoneClaimed(campaignId, milestoneId)`              | `isMilestoneClaimed`    | milestone claim UI — `/causes/[id]`                |
| `get_admin()`                              | `getAdmin()`                                                    | `getAdmin`              | `useAdmin()` — `/admin`                            |
| `get_platform_fee()`                       | `getPlatformFee()`                                              | `getPlatformFee`        | `usePlatformFee()` — `/admin`, `/causes/[id]`      |
| `get_version()`                            | `getVersion()`                                                  | `getVersion`            | `useContractVersion()` — footer / debug            |
| `get_saved_campaigns(user)`                | `getSavedCampaigns(user)`                                       | `getSavedCampaigns`     | `useSavedCampaigns()` — `/dashboard`               |
| `get_saved_campaigns_count(user)`          | `getSavedCampaignsCount(user)`                                  | `getSavedCampaignsCount` | `useSavedCampaigns()` — `/dashboard`              |
| `get_approve_votes(campaign_id)`           | `getApproveVotes(campaignId)`                                   | `getApproveVotes`       | `useLiveVoteTallies()` — `/causes/[id]` voting panel |
| `get_reject_votes(campaign_id)`            | `getRejectVotes(campaignId)`                                    | `getRejectVotes`        | `useLiveVoteTallies()` — `/causes/[id]` voting panel |
| `has_voted(campaign_id, voter)`            | `hasVoted(campaignId, voter)`                                   | `hasVoted`              | voting panel — `/causes/[id]`                      |
| `get_min_votes_quorum()`                   | `getMinVotesQuorum()`                                           | `getMinVotesQuorum`     | `/admin` (voting configuration)                    |
| `get_approval_threshold_bps()`             | `getApprovalThresholdBps()`                                     | `getApprovalThresholdBps` | `/admin` (voting configuration)                  |
| `is_comment_censured(campaign_id, comment_hash)` | `isCommentCensured(campaignId, commentHash)`                | `isCommentCensured`     | comments — `/causes/[id]`                          |
| `get_campaign_reserve(campaign_id)`        | `getCampaignReserve(campaignId)`                                | `getCampaignReserve`    | vesting display — creator withdrawal UI            |

Client-side helpers that make no contract call of their own:
`expectedMilestonePayout()` (pure `payout_bps` math), `estimateContributeNetworkFee()`
(simulates `contribute` to price the fee), `initialCampaignsCursor()` (pagination seed).

### Write functions

| Contract function            | Parameters                                                                                                          | Frontend flow                   | Page / Component                            | Auth required        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------- | -------------------- |
| `init`                       | `admin, token, platform_fee`                                                                                        | One-time deployment setup       | (deploy scripts / CI only)                  | Admin wallet         |
| `create_campaign`            | `creator, title, description, funding_goal, duration_days, category, has_revenue_sharing, revenue_share_percentage, max_contribution_per_user` (+ `===POH_EXT===` suffix for tags/cover/milestones) | Cause submission form           | `/causes/new`                               | Creator wallet       |
| `contribute`                 | `campaign_id, contributor, amount`                                                                                  | Donation flow                   | `/causes/[id]`                              | Contributor wallet   |
| `withdraw_funds`             | `campaign_id`                                                                                                       | Creator withdrawal              | `/causes/[id]` (creator view)               | Creator wallet       |
| `cancel_campaign`            | `campaign_id`                                                                                                       | Campaign cancellation           | `/causes/[id]` (creator view)               | Creator wallet       |
| `claim_refund`               | `campaign_id, contributor`                                                                                          | Refund claiming                 | `/causes/[id]` (contributor view)           | Contributor wallet   |
| `deposit_revenue`            | `campaign_id, amount`                                                                                               | Revenue deposit                 | `/dashboard`, `/causes/[id]` (creator view) | Creator wallet       |
| `claim_revenue`              | `campaign_id, contributor`                                                                                          | Revenue claim                   | `/causes/[id]` (contributor view)           | Contributor wallet   |
| `claim_creator_revenue`      | `campaign_id`                                                                                                       | Creator-side revenue claim      | `/dashboard` (creator view)                 | Creator wallet       |
| `vote_on_campaign`           | `campaign_id, voter, approve`                                                                                       | Community validation vote       | `/causes/[id]` (voting panel)               | Token-holding wallet |
| `verify_campaign`            | `campaign_id`                                                                                                       | Admin verification              | `/admin`                                    | Admin wallet only    |
| `verify_campaign_with_votes` | `campaign_id`                                                                                                       | Trigger vote-based verification | `/causes/[id]`                              | Anyone               |
| `update_platform_fee`        | `platform_fee`                                                                                                      | Platform fee management         | `/admin`                                    | Admin wallet only    |
| `update_admin`               | `new_admin`                                                                                                         | Admin transfer                  | `/admin`                                    | Admin wallet only    |
| `set_personal_cap`           | `campaign_id, cap`                                                                                                  | Per-wallet contribution cap     | contribution form                           | Contributor wallet   |
| `save_campaign`              | `campaign_id, user`                                                                                                 | Bookmark a campaign             | `/explore`, `/causes/[id]`                   | Wallet               |
| `batch_save_campaigns`       | `campaign_ids, user`                                                                                                | Bulk bookmark sync              | onboarding / import                          | Wallet               |
| `remove_saved_campaign`      | `campaign_id, user`                                                                                                 | Remove a bookmark               | `/dashboard`                                | Wallet               |
| `clear_saved_campaigns`      | `user`                                                                                                              | Clear all bookmarks             | `/dashboard`                                | Wallet               |
| `verify_milestone`           | `campaign_id, milestone_id`                                                                                         | Milestone review                | `/admin` (or designated verifier)           | Admin / verifier     |
| `claim_milestone`            | `campaign_id, milestone_id`                                                                                         | Proportional milestone payout   | `/causes/[id]` (creator view)               | Creator wallet       |
| `extend_campaign_deadline`   | `campaign_id, additional_days`                                                                                      | One-time deadline extension     | `/causes/[id]` (creator view)               | Creator wallet       |
| `withdraw_reserve`           | `campaign_id` (wrapped as `claimReserve`)                                                                            | Vesting reserve release         | `/causes/[id]` (creator view)               | Creator wallet       |

The cause detail experience surfaces platform fee transparency in three places:

- Contributor entry: the contribution form explains that the creator pays the platform fee on withdrawal.
- Creator withdrawal: the confirmation UI shows total raised, fee amount, and creator net proceeds.
- Cause detail: the page shows the current fee percentage and an estimated fee/net breakdown based on funds raised.

If `get_platform_fee()` is unavailable, the frontend falls back to `300` basis points (`3%`) until the getter is deployed.

### Business rules to enforce on the frontend (before calling the contract)

| Rule                                                       | Contract error if violated       |
| ---------------------------------------------------------- | -------------------------------- |
| Contributor ≠ campaign creator                             | `NotAuthorized (1)`              |
| Campaign must be active and not cancelled                  | `CampaignNotActive (3)`          |
| `amount > 0` for contribute / deposit_revenue              | `ContributionMustBePositive (9)` |
| `funding_goal > 0` when creating                           | `FundingGoalMustBePositive (4)`  |
| `duration_days` between 1 and 365                          | `InvalidDuration (5)`            |
| `revenue_share_percentage` 1–5000 bps (0.01%–50%)          | `InvalidRevenueShare (6)`        |
| Revenue sharing only for `EducationalStartup` campaigns    | `RevenueShareOnlyForStartup (7)` |
| `withdraw_funds` only after goal reached                   | `FundingGoalNotReached (12)`     |
| `withdraw_funds` only after the deadline has passed        | `DeadlineNotPassed (10)`         |
| Milestone campaigns must use `claim_milestone`, not `withdraw_funds` | `ValidationFailed (15)` |
| Funds not already withdrawn                                | `FundsAlreadyWithdrawn (11)`     |
| Refund only after cancel or deadline passed + goal not met | `ValidationFailed (15)`          |
| Voter must hold the platform token                         | `NotTokenHolder (17)`            |
| Each wallet can only vote once per campaign                | `AlreadyVoted (16)`              |

---

## 6. Type Mapping: Rust Structs ↔ TypeScript Interfaces

### Campaign

The decoded read shape is `SpecCampaign` (`src/lib/generated/client.ts`), which
`decodeCampaign()` in `contractClient.ts` converts into the UI-facing
`Campaign` (`src/types/index.ts`).

| Rust `Campaign` (`ProofOfHeart-stellar/src/types.rs`) | TypeScript (`Campaign`) | Notes |
| ----------------------------------------------------- | ----------------------- | ----- |
| `id: u32` | `id: number` | |
| `creator: Address` | `creator: string` | G… address |
| `first_creator: Address` | `first_creator?: string` | immutable original creator |
| `pending_creator: MaybePendingCreator` | `pending_creator?: string \| null` | two-step ownership transfer |
| `pending_creator_expiry: u64` | `pending_creator_expiry?: number` | unix seconds; set only with `pending_creator` |
| `title: String` | `title: string` | |
| `description: String` | `description: string` | UI extras travel in the `===POH_EXT===` suffix |
| `funding_goal: i128` | `funding_goal: bigint` | token smallest units (POH has 7 decimals) |
| `deadline: u64` | `deadline: number` | unix seconds |
| `amount_raised: i128` | `amount_raised: bigint` | |
| `status: u32` | `is_active` / `is_cancelled` / `is_verified` / `funds_withdrawn` + `status` | bitfield — decoded, see below |
| `category: Category` | `category: Category` | enum discriminant 0–3 |
| `has_revenue_sharing: bool` | `has_revenue_sharing: boolean` | |
| `revenue_share_percentage: u32` | `revenue_share_percentage: number` | basis points (300 = 3%) |
| `max_contribution_per_user: i128` | `max_contribution_per_user?: bigint` | `0` is the explicit "no cap" sentinel |
| `fee_override: Option<u32>` | `fee_override?: number \| null` | `null` uses the global platform fee |
| `deadline_extended: bool` | `deadline_extended?: boolean` | extendable exactly once |
| `effective_amount_raised: i128` | `effective_amount_raised?: bigint` | live raise after refunds (pro-rata base) |
| _(not stored — read the `campaign_created` event)_ | `created_at?: number` | unix seconds |

> **Amounts:** all contract amounts are `i128` in the campaign token's smallest
> units and stay `bigint` end to end; convert only at the presentation layer
> (`POH` has 7 decimals: `1_000_000n` = 0.1 POH).

> **Multi-token campaigns:** `create_campaign` denominates in the platform token
> set by `init`; the contract also offers per-campaign tokens
> (`create_campaign_with_token` plus the admin token allowlist). Those
> entrypoints have no frontend wrapper yet — see the contract's
> [API.md](https://github.com/Iris-IV/ProofOfHeart-stellar/blob/main/docs/API.md).

### Status bitfield

The contract replaced the old booleans with one `status: u32` bitfield. Decoding
lives in `src/lib/campaignStatusFlags.ts`:

| Bit | Constant | Contract meaning | Decoded boolean |
| --- | -------- | ---------------- | --------------- |
| `1 << 0` | `CAMPAIGN_ACTIVE` | accepting contributions | `is_active` |
| `1 << 1` | `CAMPAIGN_PAUSED` | contract calls it "paused"; means cancelled | `is_cancelled` |
| `1 << 2` | `CAMPAIGN_VALIDATED` | admin-verified | `is_verified` |
| `1 << 3` | `CAMPAIGN_SUCCEEDED` | funds withdrawn | `funds_withdrawn` |

`deriveStatus()` (`src/types/index.ts`) then collapses those four booleans into
the UI's `CampaignStatus`, in priority order:
`cancelled > funded > failed > verified > active`.

```ts
import { decodeCampaignStatusFlags } from "@/lib/campaignStatusFlags";

const flags = decodeCampaignStatusFlags(specCampaign.status);
// → { is_active, is_cancelled, is_verified, funds_withdrawn }
```

### UI extensions (`===POH_EXT===`)

`CreateCampaignParams` has no fields for tags, cover images or milestones, so
`createCampaign()` appends a `===POH_EXT===` JSON suffix to the description and
`decodeCampaign()` splits it back out into `tags`, `cover_image_url` and
`milestones`. Without the suffix those fields are silently dropped. The contract
also has native tag entrypoints (`add_campaign_tag`, and friends) that are not
wrapped yet.

### Milestones

`get_milestones(campaign_id)` returns `ContractMilestone[]`
(`id`, `description`, `payout_bps`, `verified`); a plan's `payout_bps` values
sum to 10 000. Milestone campaigns must claim through `claim_milestone` —
`withdraw_funds` reverts on them (`ValidationFailed (15)`).

### Category enum

```
Rust                              TypeScript (src/types/index.ts)
--------------------------------  --------------------------------------
pub enum Category {               export enum Category {
  Learner = 0,               ->     Learner             = 0,
  EducationalStartup = 1,    ->     EducationalStartup  = 1,
  Educator = 2,              ->     Educator            = 2,
  Publisher = 3,             ->     Publisher           = 3,
}                                 }
```

`CATEGORY_LABELS` in the same file provides the display labels.

---

## 7. Error Code Reference

The contract returns error codes when operations fail. The frontend maps every code
to a user-friendly message via `src/utils/contractErrors.ts`.

| Code | `ContractError` enum value   | User-facing message                                       | Typical trigger                                  |
| ---- | ---------------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| 1    | `NotAuthorized`              | You are not authorized to perform this action.            | Creator trying to contribute to own campaign     |
| 2    | `CampaignNotFound`           | This campaign could not be found.                         | Invalid campaign ID                              |
| 3    | `CampaignNotActive`          | This campaign is no longer accepting contributions.       | Cancelled or deadline-passed campaign            |
| 4    | `FundingGoalMustBePositive`  | The funding goal must be greater than zero.               | `funding_goal ≤ 0` on create                     |
| 5    | `InvalidDuration`            | The campaign duration is invalid.                         | `duration_days` outside 1–365                    |
| 6    | `InvalidRevenueShare`        | The revenue share percentage is invalid.                  | bps outside 1–5000                               |
| 7    | `RevenueShareOnlyForStartup` | Revenue sharing is only available for startup campaigns.  | Revenue flag set on non-startup                  |
| 8    | `DeadlinePassed`             | The campaign deadline has passed.                         | Contribution after deadline                      |
| 9    | `ContributionMustBePositive` | Please enter a valid contribution amount.                 | `amount ≤ 0`                                     |
| 10   | `DeadlineNotPassed`          | The campaign deadline has not passed yet.                 | Attempted refund before deadline                 |
| 11   | `FundsAlreadyWithdrawn`      | The funds for this campaign have already been withdrawn.  | Double-withdraw attempt                          |
| 12   | `FundingGoalNotReached`      | The funding goal has not been reached yet.                | Withdraw before goal met                         |
| 13   | `NoFundsToWithdraw`          | There are no funds available to withdraw.                 | Zero balance refund / revenue claim              |
| 14   | `CampaignAlreadyVerified`    | This campaign has already been verified.                  | Re-verifying                                     |
| 15   | `ValidationFailed`           | Validation failed. Please check your input and try again. | General input guard                              |
| 16   | `AlreadyVoted`               | You have already voted on this campaign.                  | Duplicate vote attempt                           |
| 17   | `NotTokenHolder`             | You must hold the platform token to vote.                 | Voter has 0 token balance                        |
| 18   | `VotingQuorumNotMet`         | Not enough votes have been cast yet.                      | `verify_campaign_with_votes` before quorum       |
| 19   | `VotingThresholdNotMet`      | The approval threshold has not been reached.              | `verify_campaign_with_votes` with < 60% approval |

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

| Event topic                                       | Data payload                     | Emitted by                                       |
| ------------------------------------------------- | -------------------------------- | ------------------------------------------------ |
| `("campaign_created", count, creator)`            | `title: String`                  | `create_campaign`                                |
| `("contribution_made", campaign_id, contributor)` | `amount: i128`                   | `contribute`                                     |
| `("withdrawal", campaign_id, creator)`            | `amount: i128`                   | `withdraw_funds`                                 |
| `("campaign_cancelled", campaign_id)`             | `()`                             | `cancel_campaign`                                |
| `("refund_claimed", campaign_id, contributor)`    | `amount: i128`                   | `claim_refund`                                   |
| `("revenue_deposited", campaign_id)`              | `amount: i128`                   | `deposit_revenue`                                |
| `("revenue_claimed", campaign_id, contributor)`   | `amount: i128`                   | `claim_revenue`                                  |
| `("campaign_vote_cast", campaign_id, voter)`      | `approve: bool`                  | `vote_on_campaign`                               |
| `("campaign_verified", campaign_id)`              | `()` or `approve_votes: u32`     | `verify_campaign` / `verify_campaign_with_votes` |
| `("fee_updated",)`                                | `(old_fee, new_fee): (u32, u32)` | `update_platform_fee`                            |

### 8.1 Event-Driven Cache Invalidation

The frontend uses React Query (`@tanstack/react-query`) for data caching. When contract events occur, we perform **targeted cache invalidation** scoped by campaign id to avoid over-invalidation.

**Implementation:** `src/lib/cacheInvalidation.ts`

The `invalidateQueriesForEvent()` function maps each event topic to the appropriate React Query keys:

| Event topic         | Query keys invalidated (scoped by campaign id)                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contribution_made` | `['campaign', campaignId]`, `['campaignUpdates', campaignId]`, `['campaignComments', campaignId]`, `['contributions', walletAddress]` (if current user is contributor) |
| `withdraw_funds`    | `['campaign', campaignId]`, `['campaignUpdates', campaignId]`, `['contributions', walletAddress]` (current user), `['revenueSharing', campaignId, walletAddress]`      |
| `cancel_campaign`   | `['campaign', campaignId]`, `['campaignUpdates', campaignId]`, `['campaigns']` (list)                                                                                  |
| `claim_refund`      | `['campaign', campaignId]`, `['contributions', walletAddress]` (if current user is contributor)                                                                        |
| `vote_on_campaign`  | `['campaign', campaignId]`, `['campaigns']` (list)                                                                                                                     |
| `deposit_revenue`   | `['campaign', campaignId]`, `['revenueSharing', campaignId, *]` (all users)                                                                                            |
| `verify_campaign`   | `['campaign', campaignId]`, `['campaigns']` (list), `['admin']`                                                                                                        |

**Usage in event hooks:**

```ts
import { invalidateQueriesForEvents } from "@/lib/cacheInvalidation";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/components/WalletContext";

const queryClient = useQueryClient();
const { publicKey: currentWalletAddress } = useWallet();

// When new events are received from polling
if (unseen.length > 0) {
  invalidateQueriesForEvents(queryClient, unseen, currentWalletAddress);
}
```

**Key principles:**

- **Scope by campaign id:** Only invalidate queries for the specific campaign affected by the event
- **Scope by wallet address:** Only invalidate user-specific queries (contributions, revenue) when the current user is involved
- **Avoid broad invalidation:** Never invalidate all campaigns unless the event truly affects the entire list (e.g., verification status changes)
- **Batch processing:** Use `invalidateQueriesForEvents()` for batches to avoid duplicate invalidations for the same campaign

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
# Use server-side proxy for mainnet to keep API keys secure
MAINNET_RPC_URL=https://mainnet.stellar.validationcloud.io/v1/<API_KEY>
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

1. **Decide read vs. write:**

   - **Read (view) function** — regenerate the typed bindings first with
     `npm run bindings:generate` (see `src/lib/generated/README.md`). That adds
     a method to `ProofOfHeartGeneratedClient`, and the wrapper in
     `contractClient.ts` becomes a thin delegate:

     ```ts
     export async function getMinVotesQuorum(): Promise<number> {
       if (USE_MOCKS) return MOCK_MIN_VOTES_QUORUM;
       return generated.getMinVotesQuorum();
     }
     ```

   - **Write (invocation) function** — build the operation and submit it with
     `buildAndSubmitTransaction`:

     ```ts
     export async function contribute(
       campaignId: number,
       contributor: string,
       amount: bigint,
     ): Promise<void> {
       validateAmount(amount);
       if (USE_MOCKS) {
         /* simulate success */ return;
       }
       const contract = new Contract(CONTRACT_ADDRESS);
       const op = contract.call(
         "contribute",
         nativeToScVal(campaignId, { type: "u32" }),
         new Address(contributor).toScVal(),
         nativeToScVal(amount, { type: "i128" }),
       );
       await buildAndSubmitTransaction(contributor, op, { operation: "contribute" });
     }
     ```

   Keep the wrapper's signature UI-friendly (`bigint` amounts, plain numbers)
   and do all contract encoding inside the wrapper.

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
     showSuccess("Contribution recorded on-chain.");
   } catch (err) {
     showError(parseContractError(err));
   }
   ```

4. **Guard the action in the UI** based on campaign state to avoid predictable
   contract errors before the transaction is even built (see business rules table in
   section 5).

5. **Update this document** — add the new function to the mapping tables in
   section 5, and if it changes the decoded shape, the type mapping in
   section 6.

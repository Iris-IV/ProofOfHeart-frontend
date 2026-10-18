import { Campaign, CampaignStatus } from "@/types";
import type { MockScenario } from "@/hooks/useDevMockScenario";

/**
 * # Mock causes and dev scenarios (offline development)
 *
 * Helpers for running the app and its tests without a Soroban RPC node or a
 * deployed contract. Dev only: nothing here is used when mock mode is off.
 *
 * ## 1. Turn on mock mode
 *
 * Mock mode is controlled by one flag, read as the exact string `"true"`
 * (`IS_MOCK_MODE` in `src/lib/runtimeEnv.ts`):
 *
 * ```bash
 * cp .env.example .env.local   # already contains NEXT_PUBLIC_USE_MOCKS=true
 * npm run dev
 * ```
 *
 * or for a single run: `NEXT_PUBLIC_USE_MOCKS=true npm run dev`.
 *
 * Production builds refuse to start with it on:
 * `assertProductionContractConfig()` throws when `NODE_ENV=production` and
 * `NEXT_PUBLIC_USE_MOCKS=true`.
 *
 * ## 2. Where the mock data comes from
 *
 * | What | Where | Notes |
 * | --- | --- | --- |
 * | Campaign dataset | `MOCK_CAMPAIGNS` in `src/lib/contractClient.ts` | 6 hand written causes plus 114 generated ones (ids 1 to 120), all relative to the fixed timestamp `1700000000` so output is deterministic. |
 * | Contract reads | `src/lib/contractClient.ts` | `getAllCampaigns`, `listCampaigns`, `getCampaign`, `getCampaignCount` and `getPlatformStats` serve `MOCK_CAMPAIGNS`; `getContribution` returns `0n`. |
 * | Contract writes | `src/lib/contractClient.ts` | Writes with a mock branch (for example `contribute`, `createCampaign`, `claimMilestone`) skip signing and RPC, report every lifecycle phase to `options.onStatus`, and resolve with a fixed hash such as `"mock_tx_contribute"`. |
 * | Listing filters | `src/lib/mockCauses.ts` | Only the `CATEGORIES`, `STATUSES` and `SORT_OPTIONS` constants for filter dropdowns. It holds no campaign data. |
 * | Per campaign states | this file | `applyMockScenario` reshapes a campaign into one of the scenarios below. |
 *
 * ## 3. Switch a campaign's state at runtime
 *
 * With mock mode on and `NODE_ENV=development`, the **Mock** button in the
 * bottom right corner opens `DevMockPanel` (`src/components/DevMockPanel.tsx`).
 * Picking a scenario for a campaign:
 *
 * 1. stores it in `sessionStorage["devMockScenarios"]` as
 *    `{ "<campaignId>": "<scenario>" }`, so it survives reloads in the tab;
 * 2. dispatches `devMockScenarioChanged` on `window` with
 *    `detail: { campaignId, scenario }` (`campaignId` is a string);
 * 3. "Reset" clears the storage key and dispatches `devMockScenariosReset`.
 *
 * `useDevMockScenario(campaignId)` (`src/hooks/useDevMockScenario.ts`) reads
 * the stored value and follows both events. Combine it with
 * `applyMockScenario` in a component:
 *
 * ```tsx
 * import { useDevMockScenario } from "@/hooks/useDevMockScenario";
 * import { applyMockScenario } from "@/lib/devMockScenarios";
 *
 * export function CampaignCard({ campaign }: { campaign: Campaign }) {
 *   const scenario = useDevMockScenario(campaign.id);
 *   if (scenario === "error") return <ErrorState />;
 *   const shown = applyMockScenario(campaign, scenario);
 *   return <h2>{shown.title}</h2>;
 * }
 * ```
 *
 * The same toggle works from the browser console, which is handy for
 * scripted QA:
 *
 * ```js
 * sessionStorage.setItem("devMockScenarios", JSON.stringify({ "1": "near_deadline" }));
 * window.dispatchEvent(
 *   new CustomEvent("devMockScenarioChanged", {
 *     detail: { campaignId: "1", scenario: "near_deadline" },
 *   }),
 * );
 * ```
 *
 * ## 4. Scenarios
 *
 * Every scenario except `default`, `empty` and `error` sets the lifecycle
 * flags and `status` explicitly. Deadlines are relative to `1700000000`.
 *
 * | Scenario | Result |
 * | --- | --- |
 * | `default` | Campaign unchanged. |
 * | `active` | Active, unverified, 50% funded, 30 days left. |
 * | `verified` | Active and verified, 33% funded, 30 days left. |
 * | `funded` | Inactive, verified, 100% raised, funds withdrawn, ended 5 days ago. |
 * | `cancelled` | Cancelled, 25% funded. |
 * | `failed` | Ended 10 days ago at 20% of the goal. |
 * | `empty` | Blank title, description and tags, zero goal and raised. |
 * | `paused` | Contract pause stand in: inactive but verified and not cancelled, 50% funded. |
 * | `goal_completed` | Still active with 200% of the goal raised. |
 * | `near_deadline` | 23 hours left at 95% of the goal. |
 * | `empty_state` | Newly created and active with no contributions. |
 * | `error` | Campaign unchanged; the component is expected to render its error UI. |
 *
 * `MOCK_SCENARIOS` holds the label and description shown in the panel for each.
 *
 * ## 5. Add a scenario
 *
 * 1. Add the name to the `MockScenario` union in `src/hooks/useDevMockScenario.ts`.
 * 2. Add a `case` to `applyMockScenario` below that returns a new object
 *    (never mutate the input).
 * 3. Add a `{ value, label, description }` entry to `MOCK_SCENARIOS`.
 * 4. Cover it in `src/lib/devMockScenarios.test.ts`.
 *
 * ## 6. Offline unit tests
 *
 * `createMockSorobanRpcServer` is an in-memory stand in for the RPC methods
 * the client uses, so Jest tests run with no network:
 *
 * ```typescript
 * import { createMockSorobanRpcServer } from "@/lib/devMockScenarios";
 *
 * const server = createMockSorobanRpcServer({ sequence: 1_000_000 });
 *
 * await server.simulateTransaction("transaction_xdr"); // { status: "SUCCESS", ... }
 * await server.simulateTransaction("FAIL_xdr");        // { status: "FAILED", ... }
 * await server.sendTransaction("ERROR_xdr");           // { status: "ERROR", hash: "mock_tx_hash_error" }
 * await server.getTransaction("hash_error");           // { status: "NOT_FOUND" }
 *
 * const down = createMockSorobanRpcServer({ healthy: false });
 * await expect(down.getHealth()).rejects.toThrow("RPC Server Unhealthy");
 * ```
 *
 * `applyMockScenario` is a pure function and can be asserted directly:
 *
 * ```typescript
 * const campaign = applyMockScenario(baseCampaign, "funded");
 * expect(campaign.funds_withdrawn).toBe(true);
 * ```
 *
 * See also `docs/DEV_MOCK_PANEL.md` and `docs/DEV_TOOLS.md`.
 */

export function applyMockScenario(campaign: Campaign, scenario: MockScenario): Campaign {
  if (scenario === "default") {
    return campaign;
  }

  const now = 1700000000;

  switch (scenario) {
    case "active":
      // Active campaign: ongoing, not verified, not funded
      return {
        ...campaign,
        is_active: true,
        is_verified: false,
        funds_withdrawn: false,
        is_cancelled: false,
        deadline: now + 86400 * 30, // 30 days from now
        amount_raised: campaign.funding_goal / BigInt(2), // 50% funded
        status: "active" as CampaignStatus,
      };

    case "verified":
      // Verified campaign: verified but not yet funded
      return {
        ...campaign,
        is_active: true,
        is_verified: true,
        funds_withdrawn: false,
        is_cancelled: false,
        deadline: now + 86400 * 30,
        amount_raised: campaign.funding_goal / BigInt(3), // 33% funded
        status: "verified" as CampaignStatus,
      };

    case "funded":
      // Funded campaign: funds have been withdrawn
      return {
        ...campaign,
        is_active: false,
        is_verified: true,
        funds_withdrawn: true,
        is_cancelled: false,
        deadline: now - 86400 * 5, // Ended 5 days ago
        amount_raised: campaign.funding_goal,
        status: "funded" as CampaignStatus,
      };

    case "cancelled":
      // Cancelled campaign
      return {
        ...campaign,
        is_active: false,
        is_verified: false,
        funds_withdrawn: false,
        is_cancelled: true,
        deadline: now + 86400 * 30,
        amount_raised: campaign.funding_goal / BigInt(4), // 25% funded
        status: "cancelled" as CampaignStatus,
      };

    case "failed":
      // Failed campaign: deadline passed, goal not reached
      return {
        ...campaign,
        is_active: false,
        is_verified: false,
        funds_withdrawn: false,
        is_cancelled: false,
        deadline: now - 86400 * 10, // Ended 10 days ago
        amount_raised: campaign.funding_goal / BigInt(5), // 20% funded
        status: "failed" as CampaignStatus,
      };

    case "empty":
      // Empty state: no data
      return {
        ...campaign,
        title: "",
        description: "",
        amount_raised: BigInt(0),
        funding_goal: BigInt(0),
        tags: [],
      };

    case "paused":
      // Contract paused state: campaign frozen
      return {
        ...campaign,
        is_active: false,
        is_verified: true,
        funds_withdrawn: false,
        is_cancelled: false,
        deadline: now + 86400 * 15, // Still has time
        amount_raised: campaign.funding_goal / BigInt(2), // 50% funded
        status: "active" as CampaignStatus,
        // Contract-level pause (represented by is_active: false but not cancelled)
      };

    case "goal_completed":
      // Goal completion state: funding goal reached before deadline
      return {
        ...campaign,
        is_active: true,
        is_verified: true,
        funds_withdrawn: false,
        is_cancelled: false,
        deadline: now + 86400 * 10, // Still active
        amount_raised: campaign.funding_goal * BigInt(2), // 200% funded
        status: "active" as CampaignStatus,
      };

    case "near_deadline":
      // Near deadline state: less than 24 hours remaining
      return {
        ...campaign,
        is_active: true,
        is_verified: true,
        funds_withdrawn: false,
        is_cancelled: false,
        deadline: now + 86400 * 1 - 3600, // 23 hours remaining
        amount_raised: (campaign.funding_goal * BigInt(95)) / BigInt(100), // 95% funded
        status: "active" as CampaignStatus,
      };

    case "empty_state":
      // Empty campaign state: newly created with no contributions
      return {
        ...campaign,
        is_active: true,
        is_verified: false,
        funds_withdrawn: false,
        is_cancelled: false,
        deadline: now + 86400 * 30,
        amount_raised: BigInt(0), // No contributions yet
        status: "active" as CampaignStatus,
      };

    case "error":
      // Error state: use campaign as-is (component should handle null/error)
      return campaign;

    default:
      return campaign;
  }
}

/**
 * Get all available mock scenarios for UI testing.
 */
export const MOCK_SCENARIOS = [
  { value: "default", label: "Default", description: "Original mock data" },
  { value: "active", label: "Active", description: "Ongoing campaign" },
  { value: "verified", label: "Verified", description: "Verified but not funded" },
  { value: "funded", label: "Funded", description: "Successfully funded" },
  { value: "cancelled", label: "Cancelled", description: "Campaign cancelled" },
  { value: "failed", label: "Failed", description: "Deadline passed, goal not met" },
  { value: "empty", label: "Empty", description: "No data" },
  { value: "paused", label: "Paused", description: "Contract paused state" },
  { value: "goal_completed", label: "Goal Completed", description: "Funding goal exceeded" },
  { value: "near_deadline", label: "Near Deadline", description: "Less than 24 hours remaining" },
  { value: "empty_state", label: "Empty State", description: "No contributions yet" },
  { value: "error", label: "Error", description: "Error state" },
] as const;

/**
 * Mock Soroban RPC Server interface for offline unit testing.
 *
 * Provides a lightweight in-memory mock of Soroban RPC endpoints
 * for use in Jest tests without requiring a live Stellar network connection.
 *
 * ## Key Features
 * - Zero external dependencies
 * - Configurable ledger sequence and health status
 * - Simulates transaction success/failure based on XDR content
 * - Predictable mock responses for test determinism
 *
 * ## Example Usage
 *
 * ```typescript
 * const server = createMockSorobanRpcServer({ sequence: 5000000, healthy: true });
 *
 * // Test transaction simulation
 * const simResult = await server.simulateTransaction('valid_xdr');
 * expect(simResult.status).toBe('SUCCESS');
 *
 * // Test transaction submission
 * const sendResult = await server.sendTransaction('signed_xdr');
 * expect(sendResult.status).toBe('PENDING');
 * expect(sendResult.hash).toBe('mock_tx_hash_success');
 * ```
 */
export interface MockSorobanRpcServer {
  getLatestLedger(): Promise<{ sequence: number; id: string }>;
  getHealth(): Promise<{ status: "healthy" }>;
  getLedgerEntries(
    keys: string[],
  ): Promise<{ entries: Array<{ key: string; val: string; liveUntilLedgerSeq: number }> }>;
  simulateTransaction(
    txXdr: string,
  ): Promise<{
    status: "SUCCESS" | "FAILED";
    minResourceFee: string;
    results?: Array<{ retval: string }>;
  }>;
  sendTransaction(signedTxXdr: string): Promise<{ status: "PENDING" | "ERROR"; hash: string }>;
  getTransaction(hash: string): Promise<{ status: "SUCCESS" | "NOT_FOUND"; resultXdr?: string }>;
}

export interface MockSorobanRpcServerOptions {
  sequence?: number;
  healthy?: boolean;
}

/**
 * Creates a lightweight mock Soroban RPC Server for offline Jest unit testing.
 */
export function createMockSorobanRpcServer(
  options: MockSorobanRpcServerOptions = {},
): MockSorobanRpcServer {
  const currentSequence = options.sequence ?? 1234567;
  const isHealthy = options.healthy ?? true;

  return {
    async getLatestLedger() {
      return {
        sequence: currentSequence,
        id: "0000000000000000000000000000000000000000000000000000000000000000",
      };
    },

    async getHealth() {
      if (!isHealthy) {
        throw new Error("RPC Server Unhealthy");
      }
      return { status: "healthy" };
    },

    async getLedgerEntries(keys: string[]) {
      return {
        entries: keys.map((key) => ({
          key,
          val: "AAAAAA==",
          liveUntilLedgerSeq: currentSequence + 4096,
        })),
      };
    },

    async simulateTransaction(txXdr: string) {
      if (txXdr.includes("FAIL")) {
        return { status: "FAILED", minResourceFee: "100" };
      }
      return {
        status: "SUCCESS",
        minResourceFee: "100",
        results: [{ retval: "AAAAAA==" }],
      };
    },

    async sendTransaction(signedTxXdr: string) {
      if (signedTxXdr.includes("ERROR")) {
        return { status: "ERROR", hash: "mock_tx_hash_error" };
      }
      return { status: "PENDING", hash: "mock_tx_hash_success" };
    },

    async getTransaction(hash: string) {
      if (hash.includes("error")) {
        return { status: "NOT_FOUND" };
      }
      return { status: "SUCCESS", resultXdr: "AAAAAA==" };
    },
  };
}

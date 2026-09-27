import { Campaign, CampaignStatus } from "@/types";
import type { MockScenario } from "@/hooks/useDevMockScenario";

/**
 * Dev-only utility to apply mock scenarios to campaigns.
 * Used by DevMockPanel to test different campaign states at runtime.
 *
 * Never shipped in production.
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
  { value: "error", label: "Error", description: "Error state" },
] as const;

/**
 * Mock Soroban RPC Server interface for offline unit testing (#1594).
 */
export interface MockSorobanRpcServer {
  getLatestLedger(): Promise<{ sequence: number; id: string }>;
  getHealth(): Promise<{ status: "healthy" }>;
  getLedgerEntries(keys: string[]): Promise<{ entries: Array<{ key: string; val: string; liveUntilLedgerSeq: number }> }>;
  simulateTransaction(txXdr: string): Promise<{ status: "SUCCESS" | "FAILED"; minResourceFee: string; results?: Array<{ retval: string }> }>;
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
export function createMockSorobanRpcServer(options: MockSorobanRpcServerOptions = {}): MockSorobanRpcServer {
  const currentSequence = options.sequence ?? 1234567;
  const isHealthy = options.healthy ?? true;

  return {
    async getLatestLedger() {
      return { sequence: currentSequence, id: "0000000000000000000000000000000000000000000000000000000000000000" };
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

import { Campaign, CampaignStatus, deriveStatus } from "@/types";
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

  const now = Math.floor(Date.now() / 1000);

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

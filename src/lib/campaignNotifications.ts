// ---------------------------------------------------------------------------
// Campaign Expiry Notification System
// ---------------------------------------------------------------------------

import { getCampaignCount, getCampaign } from "@/lib/contractClient";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const HOURS_BEFORE_DEADLINE = 48;
const SECONDS_IN_HOUR = 3600;
const WARNING_WINDOW_SECONDS = HOURS_BEFORE_DEADLINE * SECONDS_IN_HOUR;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpiringCampaign {
  id: number;
  title: string;
  creator: string;
  deadline: number;
  amountRaised: bigint;
  fundingGoal: bigint;
  isFunded: boolean;
  hoursRemaining: number;
}

export interface NotificationPayload {
  event: "campaign_expiry_warning";
  campaignId: number;
  campaignTitle: string;
  creatorAddress: string;
  hoursRemaining: number;
  amountRaised: string;
  fundingGoal: string;
  fundingPercentage: number;
  deadline: number;
  source: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Check if a campaign is within the warning window (48 hours before deadline)
 */
export function isWithinWarningWindow(deadline: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const timeUntilDeadline = deadline - now;
  return timeUntilDeadline > 0 && timeUntilDeadline <= WARNING_WINDOW_SECONDS;
}

/**
 * Calculate remaining hours until deadline
 */
export function calculateHoursRemaining(deadline: number): number {
  const now = Math.floor(Date.now() / 1000);
  const secondsRemaining = deadline - now;
  return Math.max(0, Math.floor(secondsRemaining / SECONDS_IN_HOUR));
}

/**
 * Calculate funding percentage
 */
export function calculateFundingPercentage(amountRaised: bigint, fundingGoal: bigint): number {
  if (fundingGoal <= BigInt(0)) return 0;
  const percentage = (amountRaised * BigInt(100)) / fundingGoal;
  return Math.min(100, Number(percentage));
}

/**
 * Fetch all campaigns that are expiring within the warning window
 */
export async function fetchExpiringCampaigns(
  notifiedCampaigns?: Set<number>,
): Promise<ExpiringCampaign[]> {
  const expiring: ExpiringCampaign[] = [];

  try {
    const count = await getCampaignCount();

    for (let i = 1; i <= count; i++) {
      try {
        const campaign = await getCampaign(i);

        if (!campaign) {
          continue;
        }

        // Check if campaign is within warning window
        if (!isWithinWarningWindow(campaign.deadline)) {
          continue;
        }

        // Check if already funded
        const isFunded = campaign.amount_raised >= campaign.funding_goal;
        if (isFunded) {
          continue;
        }

        // Check if already notified (if tracking provided)
        if (notifiedCampaigns && notifiedCampaigns.has(i)) {
          continue;
        }

        const hoursRemaining = calculateHoursRemaining(campaign.deadline);

        expiring.push({
          id: i,
          title: campaign.title,
          creator: campaign.creator,
          deadline: campaign.deadline,
          amountRaised: campaign.amount_raised,
          fundingGoal: campaign.funding_goal,
          isFunded,
          hoursRemaining,
        });
      } catch (error) {
        console.error(`Failed to fetch campaign ${i}:`, error);
        // Continue to next campaign
      }
    }
  } catch (error) {
    console.error("Failed to get campaign count:", error);
    throw new Error("Failed to fetch campaigns");
  }

  return expiring;
}

/**
 * Send a notification for a single expiring campaign
 */
export async function sendCampaignNotification(
  campaign: ExpiringCampaign,
  webhookUrl: string,
): Promise<void> {
  const fundingPercentage = calculateFundingPercentage(campaign.amountRaised, campaign.fundingGoal);

  const payload: NotificationPayload = {
    event: "campaign_expiry_warning",
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    creatorAddress: campaign.creator,
    hoursRemaining: campaign.hoursRemaining,
    amountRaised: campaign.amountRaised.toString(),
    fundingGoal: campaign.fundingGoal.toString(),
    fundingPercentage,
    deadline: campaign.deadline,
    source: "proof_of_heart_frontend",
    timestamp: new Date().toISOString(),
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}`);
  }

  console.log(`Notification sent for campaign ${campaign.id}`);
}

/**
 * Process all expiring campaigns and send notifications
 */
export async function processExpiringCampaigns(
  webhookUrl: string,
  notifiedCampaigns?: Set<number>,
): Promise<{ notified: number; failed: number; campaigns: ExpiringCampaign[] }> {
  const expiringCampaigns = await fetchExpiringCampaigns(notifiedCampaigns);

  if (expiringCampaigns.length === 0) {
    return { notified: 0, failed: 0, campaigns: [] };
  }

  const results = await Promise.allSettled(
    expiringCampaigns.map((campaign) => sendCampaignNotification(campaign, webhookUrl)),
  );

  const successful = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  // Mark successful campaigns as notified
  if (notifiedCampaigns) {
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        notifiedCampaigns.add(expiringCampaigns[index].id);
      }
    });
  }

  return {
    notified: successful,
    failed,
    campaigns: expiringCampaigns,
  };
}

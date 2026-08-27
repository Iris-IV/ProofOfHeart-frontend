import { Campaign } from "@/types";

const NOTIFIED_KEY_PREFIX = "poh_expiry_notified_v1";
const WEBHOOK_URL = process.env.NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL || process.env.CREATOR_EMAIL_WEBHOOK_URL;
const FORTY_EIGHT_HOURS_S = 48 * 3600;

function notifiedKey(campaignId: number): string {
  return `${NOTIFIED_KEY_PREFIX}:${campaignId}`;
}

function hasBeenNotified(campaignId: number): boolean {
  try {
    return localStorage.getItem(notifiedKey(campaignId)) === "1";
  } catch {
    return false;
  }
}

function markNotified(campaignId: number): void {
  try {
    localStorage.setItem(notifiedKey(campaignId), "1");
  } catch {
    /* ignore */
  }
}

export function shouldNotifyExpiry(campaign: Campaign, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (campaign.is_cancelled || campaign.is_funded || !campaign.is_active) return false;
  const secondsLeft = campaign.deadline - nowSeconds;
  if (secondsLeft <= 0 || secondsLeft > FORTY_EIGHT_HOURS_S) return false;
  if (hasBeenNotified(campaign.id)) return false;
  return true;
}

export async function notifyCampaignExpiry(campaign: Campaign): Promise<boolean> {
  if (!WEBHOOK_URL) return false;
  if (!shouldNotifyExpiry(campaign)) return false;

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: campaign.id,
        creator: campaign.creator,
        title: campaign.title,
        deadline: campaign.deadline,
        hoursRemaining: Math.ceil((campaign.deadline - Math.floor(Date.now() / 1000)) / 3600),
        type: "48h_remaining",
      }),
    });
    markNotified(campaign.id);
    return true;
  } catch {
    return false;
  }
}

export function scheduleExpiryChecks(campaigns: Campaign[], onNotify?: (c: Campaign) => void): () => void {
  const check = () => {
    for (const c of campaigns) {
      if (shouldNotifyExpiry(c)) {
        void notifyCampaignExpiry(c).then((sent) => {
          if (sent && onNotify) onNotify(c);
        });
      }
    }
  };
  check();
  const id = setInterval(check, 60 * 60 * 1000);
  return () => clearInterval(id);
}

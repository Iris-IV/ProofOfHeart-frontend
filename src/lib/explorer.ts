import { getCampaign } from "./contractClient";
import { Campaign } from "../types";

const campaignCache: Record<number, Campaign | null> = {};

export async function getCampaignById(id: number): Promise<Campaign | null> {
  if (id in campaignCache) {
    return campaignCache[id];
  }
  try {
    const campaign = await getCampaign(id);
    campaignCache[id] = campaign;
    return campaign;
  } catch {
    campaignCache[id] = null;
    return null;
  }
}

export async function getCampaignTitle(id: number): Promise<string | null> {
  const campaign = await getCampaignById(id);
  return campaign?.title ?? null;
}
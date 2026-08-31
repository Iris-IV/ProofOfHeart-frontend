import type { Campaign } from "@/types";

export interface RecommendationScore {
  campaign: Campaign;
  score: number;
  reasons: string[];
}

function categoryScore(a: Campaign, b: Campaign): number {
  return a.category === b.category ? 40 : 0;
}

function tagScore(a: Campaign, b: Campaign): number {
  if (!a.tags || !b.tags) return 0;
  const setB = new Set(b.tags);
  const overlap = a.tags.filter((t) => setB.has(t)).length;
  return Math.min(30, overlap * 10);
}

function fundingProximityScore(a: Campaign, b: Campaign): number {
  const pctA = Number(a.amount_raised) / Number(a.funding_goal || 1n);
  const pctB = Number(b.amount_raised) / Number(b.funding_goal || 1n);
  return Math.max(0, 15 - Math.abs(pctA - pctB) * 15);
}

export function scoreSimilarity(target: Campaign, candidate: Campaign): RecommendationScore {
  const reasons: string[] = [];
  let score = 0;
  const cat = categoryScore(target, candidate);
  if (cat > 0) { score += cat; reasons.push("same category"); }
  const tag = tagScore(target, candidate);
  if (tag > 0) { score += tag; reasons.push("shared interests"); }
  const prox = fundingProximityScore(target, candidate);
  score += prox;
  if (candidate.is_verified) { score += 5; reasons.push("verified"); }
  return { campaign: candidate, score, reasons };
}

function getCuratedCauses(allCampaigns: Campaign[], limit: number, excludeIds: Set<number>): Campaign[] {
  return allCampaigns
    .filter((c) => !excludeIds.has(c.id) && c.status === "active")
    .sort((a, b) => Number(b.amount_raised) - Number(a.amount_raised))
    .slice(0, limit);
}

export function getRecommendedCauses(
  donatedCampaign: Campaign,
  allCampaigns: Campaign[],
  limit = 4,
  excludeIds: number[] = []
): Campaign[] {
  const excluded = new Set([donatedCampaign.id, ...excludeIds);
  const scoredCampaigns = allCampaigns
    .filter((c) => !excluded.has(c.id) && c.status !== "cancelled" && !c.is_cancelled)
    .map((c) => scoreSimilarity(donatedCampaign, c))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.campaign);

  // Fallback to curated top causes when similar campaigns are insufficient.
  if (scoredCampaigns.length < limit) {
    const selectedIds = new Set(scoredCampaigns.map((c) => c.id));
    excluded.forEach((id) => selectedIds.add(id));
    const curated = getCuratedCauses(
      allCampaigns,
      limit - scoredCampaigns.length,
      selectedIds
    );
    scoredCampaigns.push(...curated);
  }
  return scoredCampaigns;
}

export function getPersonalizedRecommendations(
  donatedCampaignIds: number[],
  allCampaigns: Campaign[],
  limit = 6
): Campaign[] {
  if (donatedCampaignIds.length === 0) {
    return getCuratedCauses(allCampaigns, limit, new Set());
  }
  const donated = allCampaigns.filter((c) => donatedCampaignIds.includes(c.id));
  const seen = new Set<number>();
  const results: Campaign[] = [];
  for (const d of donated) {
    for (const rec of getRecommendedCauses(d, allCampaigns, 3, [...seen])) {
      if (!seen.has(rec.id) && !donatedCampaignIds.includes(rec.id)) {
        seen.add(rec.id);
        results.push(rec);
      }
      if (results.length >= limit) break;
    }
    if (results.length >= limit) break;
  }
  if (results.length === 0) {
    return getCuratedCauses(allCampaigns, limit, new Set(donatedCampaignIds));
  }
  return results.slice(0, limit);
}
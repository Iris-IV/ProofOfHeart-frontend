import type { Campaign } from "@/types";

export interface RecommendationScore {
  campaign: Campaign;
  score: number;
  reasons: string[];
}

/**
 * Calculates category match score.
 * Flat hierarchy for faster computation.
 */
function categoryScore(a: Campaign, b: Campaign): number {
  return a.category === b.category ? 40 : 0;
}

/**
 * Calculates tag overlap score with optimized set operations.
 * Uses Set for O(1) lookups instead of array operations.
 */
function tagScore(a: Campaign, b: Campaign): number {
  if (!a.tags || !b.tags || a.tags.length === 0 || b.tags.length === 0) return 0;
  
  const setB = new Set(b.tags);
  let overlap = 0;
  
  // Early exit optimization: if no tags match, return 0
  for (const tag of a.tags) {
    if (setB.has(tag)) {
      overlap++;
      if (overlap * 10 >= 30) break; // Early exit at max score
    }
  }
  
  return Math.min(30, overlap * 10);
}

/**
 * Calculates funding proximity score.
 * Measures how similar two campaigns are in terms of funding progress.
 */
function fundingProximityScore(a: Campaign, b: Campaign): number {
  const pctA = Number(a.amount_raised) / Number(a.funding_goal || 1n);
  const pctB = Number(b.amount_raised) / Number(b.funding_goal || 1n);
  return Math.max(0, 15 - Math.abs(pctA - pctB) * 15);
}

/**
 * Calculates verification score bonus.
 * Verified campaigns are more trustworthy.
 */
function verificationScore(campaign: Campaign): number {
  return campaign.is_verified ? 5 : 0;
}

/**
 * Scores similarity between two campaigns.
 * Flattened logic for improved performance.
 */
export function scoreSimilarity(target: Campaign, candidate: Campaign): RecommendationScore {
  const reasons: string[] = [];
  let score = 0;

  // Category scoring
  const cat = categoryScore(target, candidate);
  if (cat > 0) {
    score += cat;
    reasons.push("same category");
  }

  // Tag scoring
  const tag = tagScore(target, candidate);
  if (tag > 0) {
    score += tag;
    reasons.push("shared interests");
  }

  // Funding proximity scoring
  const prox = fundingProximityScore(target, candidate);
  score += prox;

  // Verification scoring
  const verified = verificationScore(candidate);
  if (verified > 0) {
    score += verified;
    reasons.push("verified");
  }

  return { campaign: candidate, score, reasons };
}

/**
 * Gets curated causes with optimized filtering.
 * Flat hierarchy reduces nested operations.
 */
function getCuratedCauses(
  allCampaigns: Campaign[],
  limit: number,
  excludeIds: Set<number>,
  category?: Campaign["category"],
): Campaign[] {
  // Single-pass filtering instead of chained operations
  const filtered: Campaign[] = [];
  
  for (const c of allCampaigns) {
    if (filtered.length >= limit) break;
    
    if (
      !excludeIds.has(c.id) &&
      c.status === "active" &&
      (category === undefined || c.category === category)
    ) {
      filtered.push(c);
    }
  }

  // Sort by amount raised
  return filtered
    .sort((a, b) => Number(b.amount_raised) - Number(a.amount_raised))
    .slice(0, limit);
}

/**
 * Gets recommended causes similar to a donated campaign.
 * Optimized with single-pass filtering.
 */
export function getRecommendedCauses(
  donatedCampaign: Campaign,
  allCampaigns: Campaign[],
  limit = 4,
  excludeIds: number[] = [],
): Campaign[] {
  const excluded = new Set([donatedCampaign.id, ...excludeIds]);
  
  // Single-pass scoring and filtering
  const scoredCampaigns = allCampaigns
    .filter(
      (c) =>
        !excluded.has(c.id) &&
        c.category === donatedCampaign.category &&
        c.status !== "cancelled" &&
        !c.is_cancelled,
    )
    .map((c) => scoreSimilarity(donatedCampaign, c))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.campaign);

  // Fallback to curated top causes when similar campaigns are insufficient
  if (scoredCampaigns.length < limit) {
    const selectedIds = new Set(scoredCampaigns.map((c) => c.id));
    excluded.forEach((id) => selectedIds.add(id));
    
    const curated = getCuratedCauses(
      allCampaigns,
      limit - scoredCampaigns.length,
      selectedIds,
      donatedCampaign.category,
    );
    scoredCampaigns.push(...curated);
  }
  
  return scoredCampaigns;
}

/**
 * Gets personalized recommendations based on donation history.
 * Optimized with early exits and flattened loops.
 */
export function getPersonalizedRecommendations(
  donatedCampaignIds: number[],
  allCampaigns: Campaign[],
  limit = 6,
): Campaign[] {
  // Early exit for empty donation history
  if (donatedCampaignIds.length === 0) {
    return getCuratedCauses(allCampaigns, limit, new Set());
  }

  // Build donated campaigns map for O(1) lookups
  const donatedIdSet = new Set(donatedCampaignIds);
  const donated = allCampaigns.filter((c) => donatedIdSet.has(c.id));

  // Early exit if no donated campaigns found
  if (donated.length === 0) {
    return getCuratedCauses(allCampaigns, limit, donatedIdSet);
  }

  const seen = new Set<number>();
  const results: Campaign[] = [];

  // Flattened loop structure for better performance
  for (const d of donated) {
    // Convert seen set to array only once per donated campaign
    const seenArray = Array.from(seen);
    
    const recommendations = getRecommendedCauses(d, allCampaigns, 3, seenArray);

    for (const rec of recommendations) {
      // Early exit conditions
      if (results.length >= limit) break;
      if (seen.has(rec.id) || donatedIdSet.has(rec.id)) continue;

      seen.add(rec.id);
      results.push(rec);
    }

    if (results.length >= limit) break;
  }

  // Fallback to curated causes if insufficient recommendations
  if (results.length === 0) {
    return getCuratedCauses(allCampaigns, limit, donatedIdSet);
  }

  return results.slice(0, limit);
}

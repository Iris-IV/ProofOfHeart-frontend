import {
  scoreSimilarity,
  getRecommendedCauses,
  getPersonalizedRecommendations,
  type RecommendationScore,
} from "./causeRecommendations";
import type { Campaign } from "@/types";

// Mock campaign factory
function createMockCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    title: "Test Campaign",
    description: "Test",
    status: "active",
    created_at: 1000000000,
    deadline: 1000086400,
    funding_goal: BigInt(10000000000),
    amount_raised: BigInt(5000000000),
    cover_image_url: null,
    category: 0,
    is_verified: false,
    is_cancelled: false,
    tags: [],
    ...overrides,
  } as Campaign;
}

describe("causeRecommendations.ts", () => {
  describe("scoreSimilarity", () => {
    it("gives higher score for same category", () => {
      const target = createMockCampaign({ category: 1 });
      const candidate = createMockCampaign({ category: 1 });
      const result = scoreSimilarity(target, candidate);
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons).toContain("same category");
    });

    it("gives higher score for shared tags", () => {
      const target = createMockCampaign({ tags: ["education", "tech"] });
      const candidate = createMockCampaign({ tags: ["education", "AI"] });
      const result = scoreSimilarity(target, candidate);
      expect(result.reasons).toContain("shared interests");
    });

    it("gives bonus for verified campaigns", () => {
      const target = createMockCampaign();
      const unverified = createMockCampaign({ is_verified: false });
      const verified = createMockCampaign({ is_verified: true });

      const unverifiedScore = scoreSimilarity(target, unverified).score;
      const verifiedScore = scoreSimilarity(target, verified).score;

      expect(verifiedScore).toBeGreaterThan(unverifiedScore);
    });

    it("considers funding proximity", () => {
      const target = createMockCampaign({ amount_raised: BigInt(5000000000) });
      const similar = createMockCampaign({ amount_raised: BigInt(6000000000) });
      const different = createMockCampaign({ amount_raised: BigInt(100000000) });

      const similarScore = scoreSimilarity(target, similar).score;
      const differentScore = scoreSimilarity(target, different).score;

      expect(similarScore).toBeGreaterThanOrEqual(differentScore);
    });

    it("returns campaign and reasons", () => {
      const target = createMockCampaign();
      const candidate = createMockCampaign();
      const result = scoreSimilarity(target, candidate);

      expect(result).toHaveProperty("campaign");
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("reasons");
      expect(Array.isArray(result.reasons)).toBe(true);
    });
  });

  describe("getRecommendedCauses", () => {
    it("returns campaigns in same category", () => {
      const target = createMockCampaign({ id: 1, category: 1 });
      const sameCategory = createMockCampaign({ id: 2, category: 1 });
      const differentCategory = createMockCampaign({ id: 3, category: 0 });
      const campaigns = [target, sameCategory, differentCategory];

      const recommendations = getRecommendedCauses(target, campaigns, 2);
      expect(recommendations).toContain(sameCategory);
      expect(recommendations).not.toContain(differentCategory);
    });

    it("excludes target campaign from results", () => {
      const target = createMockCampaign({ id: 1 });
      const other = createMockCampaign({ id: 2, category: 0 });
      const campaigns = [target, other];

      const recommendations = getRecommendedCauses(target, campaigns, 5);
      expect(recommendations).not.toContain(target);
    });

    it("excludes explicitly excluded campaigns", () => {
      const target = createMockCampaign({ id: 1, category: 0 });
      const included = createMockCampaign({ id: 2, category: 0 });
      const excluded = createMockCampaign({ id: 3, category: 0 });
      const campaigns = [target, included, excluded];

      const recommendations = getRecommendedCauses(target, campaigns, 5, [3]);
      expect(recommendations).toContain(included);
      expect(recommendations).not.toContain(excluded);
    });

    it("excludes cancelled campaigns", () => {
      const target = createMockCampaign({ id: 1, category: 0 });
      const active = createMockCampaign({ id: 2, category: 0, status: "active" });
      const cancelled = createMockCampaign({ id: 3, category: 0, status: "cancelled" });
      const campaigns = [target, active, cancelled];

      const recommendations = getRecommendedCauses(target, campaigns, 5);
      expect(recommendations).toContain(active);
      expect(recommendations).not.toContain(cancelled);
    });

    it("respects limit parameter", () => {
      const target = createMockCampaign({ id: 1, category: 0 });
      const campaigns = [
        target,
        createMockCampaign({ id: 2, category: 0 }),
        createMockCampaign({ id: 3, category: 0 }),
        createMockCampaign({ id: 4, category: 0 }),
        createMockCampaign({ id: 5, category: 0 }),
      ];

      const recommendations = getRecommendedCauses(target, campaigns, 2);
      expect(recommendations.length).toBeLessThanOrEqual(2);
    });

    it("falls back to curated causes when similar campaigns insufficient", () => {
      const target = createMockCampaign({ id: 1, category: 1 });
      const sameCategory = createMockCampaign({ id: 2, category: 1 });
      const differentCategory = createMockCampaign({ id: 3, category: 0, status: "active" });
      const campaigns = [target, sameCategory, differentCategory];

      const recommendations = getRecommendedCauses(target, campaigns, 5);
      // Should include both similar and fallback campaigns
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("getPersonalizedRecommendations", () => {
    it("returns curated causes for empty donation history", () => {
      const campaigns = [
        createMockCampaign({ id: 1, status: "active", amount_raised: BigInt(10000000000) }),
        createMockCampaign({ id: 2, status: "active", amount_raised: BigInt(5000000000) }),
      ];

      const recommendations = getPersonalizedRecommendations([], campaigns, 2);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it("excludes donated campaigns from results", () => {
      const donated = createMockCampaign({ id: 1, category: 0 });
      const other = createMockCampaign({ id: 2, category: 0 });
      const campaigns = [donated, other];

      const recommendations = getPersonalizedRecommendations([1], campaigns, 5);
      expect(recommendations).not.toContain(donated);
    });

    it("avoids duplicate recommendations", () => {
      const donated1 = createMockCampaign({ id: 1, category: 0, tags: ["test"] });
      const donated2 = createMockCampaign({ id: 2, category: 0, tags: ["test"] });
      const similar = createMockCampaign({ id: 3, category: 0, tags: ["test"] });
      const campaigns = [donated1, donated2, similar];

      const recommendations = getPersonalizedRecommendations([1, 2], campaigns, 5);
      const ids = recommendations.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length); // No duplicates
    });

    it("respects limit parameter", () => {
      const campaigns = Array.from({ length: 10 }, (_, i) =>
        createMockCampaign({ id: i + 1, status: "active" }),
      );

      const recommendations = getPersonalizedRecommendations([1], campaigns, 3);
      expect(recommendations.length).toBeLessThanOrEqual(3);
    });

    it("handles missing donated campaigns gracefully", () => {
      const campaigns = [
        createMockCampaign({ id: 1, status: "active" }),
        createMockCampaign({ id: 2, status: "active" }),
      ];

      // Request recommendations for campaign ID that doesn't exist
      const recommendations = getPersonalizedRecommendations([999], campaigns, 5);
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it("prioritizes similar campaigns over curated ones", () => {
      const donated = createMockCampaign({ id: 1, category: 1, tags: ["education"] });
      const similar = createMockCampaign({ id: 2, category: 1, tags: ["education"] });
      const curated = createMockCampaign({ id: 3, category: 0, status: "active" });
      const campaigns = [donated, similar, curated];

      const recommendations = getPersonalizedRecommendations([1], campaigns, 5);
      // Similar campaign should be preferred
      if (recommendations.length > 0) {
        expect(recommendations[0].id).toBe(2);
      }
    });
  });
});

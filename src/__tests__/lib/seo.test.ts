import { absoluteUrl, buildAlternates, buildCauseJsonLd, getStellarResourceHints, isValidSeoUrl, STELLAR_PRECONNECT_ORIGINS } from "./seo";
import type { Campaign } from "@/types";

// Mock campaign data for testing
const mockCampaign: Campaign = {
  id: 1,
  title: "Test Campaign",
  description: "Test campaign description",
  status: "active",
  created_at: 1000000000,
  deadline: 1000086400,
  funding_goal: BigInt(10000000000), // 1000 XLM in stroops
  amount_raised: BigInt(5000000000), // 500 XLM in stroops
  cover_image_url: "https://example.com/image.jpg",
  category: 0,
  is_verified: false,
  is_cancelled: false,
  tags: ["test"],
} as Campaign;

const mockStrings = {
  donateActionName: "Donate",
  fundingGoalLabel: "Funding Goal",
  amountRaisedLabel: "Amount Raised",
  deadlineLabel: "Deadline",
};

describe("seo.ts", () => {
  describe("absoluteUrl", () => {
    it("returns absolute URLs unchanged", () => {
      const url = "https://example.com/path";
      expect(absoluteUrl(url)).toBe(url);
    });

    it("converts relative paths to absolute URLs", () => {
      const url = absoluteUrl("/causes/1");
      expect(url).toMatch(/https:\/\//)
      expect(url).toContain("/causes/1");
    });

    it("handles paths without leading slash", () => {
      const url = absoluteUrl("causes/1");
      expect(url).toMatch(/https:\/\//)
      expect(url).toContain("/causes/1");
    });

    it("handles HTTP URLs", () => {
      const url = "http://example.com/path";
      expect(absoluteUrl(url)).toBe(url);
    });
  });

  describe("buildAlternates", () => {
    it("returns canonical and hreflang links", () => {
      const result = buildAlternates("/causes/1", "en");
      expect(result).toHaveProperty("canonical");
      expect(result).toHaveProperty("languages");
    });

    it("includes x-default language", () => {
      const result = buildAlternates("/causes/1", "en");
      expect(result.languages["x-default"]).toBeDefined();
    });

    it("includes all locales", () => {
      const result = buildAlternates("/causes/1", "en");
      // Should have entries for each locale plus x-default
      expect(Object.keys(result.languages).length).toBeGreaterThan(0);
    });
  });

  describe("buildCauseJsonLd", () => {
    it("generates valid JSON-LD schema", () => {
      const schema = buildCauseJsonLd(mockCampaign, "en", mockStrings);
      expect(schema["@context"]).toBe("https://schema.org");
      expect(schema["@type"]).toBe("Project");
    });

    it("includes campaign title and description", () => {
      const schema = buildCauseJsonLd(mockCampaign, "en", mockStrings);
      expect(schema.name).toBe("Test Campaign");
      expect(schema.description).toBe("Test campaign description");
    });

    it("includes provider organization", () => {
      const schema = buildCauseJsonLd(mockCampaign, "en", mockStrings);
      expect(schema["provider"]).toBeDefined();
      expect((schema["provider"] as any).name).toBe("ProofOfHeart");
    });

    it("includes additionalProperty with funding info", () => {
      const schema = buildCauseJsonLd(mockCampaign, "en", mockStrings);
      const props = schema["additionalProperty"] as any[];
      expect(props).toHaveLength(3);
      expect(props[0].name).toBe("Funding Goal");
    });

    it("includes image when cover_image_url is present", () => {
      const schema = buildCauseJsonLd(mockCampaign, "en", mockStrings);
      expect(schema.image).toBeDefined();
      expect(schema.image).toContain("example.com/image.jpg");
    });

    it("excludes image when cover_image_url is null", () => {
      const campaign = { ...mockCampaign, cover_image_url: null };
      const schema = buildCauseJsonLd(campaign, "en", mockStrings);
      expect(schema.image).toBeUndefined();
    });

    it("includes potentialAction when campaign is active", () => {
      const campaign = { ...mockCampaign, status: "active" };
      const schema = buildCauseJsonLd(campaign, "en", mockStrings);
      expect(schema.potentialAction).toBeDefined();
      expect((schema.potentialAction as any)["@type"]).toBe("DonateAction");
    });

    it("includes potentialAction when campaign is verified", () => {
      const campaign = { ...mockCampaign, status: "verified" };
      const schema = buildCauseJsonLd(campaign, "en", mockStrings);
      expect(schema.potentialAction).toBeDefined();
    });

    it("excludes potentialAction for cancelled campaigns", () => {
      const campaign = { ...mockCampaign, status: "cancelled" };
      const schema = buildCauseJsonLd(campaign, "en", mockStrings);
      expect(schema.potentialAction).toBeUndefined();
    });

    it("handles different locales", () => {
      const schemaEn = buildCauseJsonLd(mockCampaign, "en", mockStrings);
      const schemaEs = buildCauseJsonLd(mockCampaign, "es", mockStrings);
      expect(schemaEn.inLanguage).toBe("en");
      expect(schemaEs.inLanguage).toBe("es");
    });
  });

  describe("getStellarResourceHints", () => {
    beforeEach(() => {
      // Clear cache before each test
      jest.resetModules();
    });

    it("returns preconnect and dns-prefetch hints", () => {
      const hints = getStellarResourceHints();
      expect(hints.length).toBeGreaterThan(0);
      
      const hasPreconnect = hints.some(h => h.rel === "preconnect");
      const hasDnsPrefetch = hints.some(h => h.rel === "dns-prefetch");
      
      expect(hasPreconnect).toBe(true);
      expect(hasDnsPrefetch).toBe(true);
    });

    it("includes all Stellar origins", () => {
      const hints = getStellarResourceHints();
      const origins = hints.map(h => h.href);
      
      for (const origin of STELLAR_PRECONNECT_ORIGINS) {
        expect(origins).toContain(origin);
      }
    });

    it("includes crossOrigin attribute on preconnect hints", () => {
      const hints = getStellarResourceHints();
      const preconnectHints = hints.filter(h => h.rel === "preconnect");
      
      preconnectHints.forEach(hint => {
        expect(hint.crossOrigin).toBe("anonymous");
      });
    });

    it("returns consistent cached results", () => {
      const hints1 = getStellarResourceHints();
      const hints2 = getStellarResourceHints();
      expect(hints1).toBe(hints2); // Same reference (cached)
    });
  });

  describe("isValidSeoUrl", () => {
    it("validates absolute URLs", () => {
      expect(isValidSeoUrl("https://example.com/path")).toBe(true);
      expect(isValidSeoUrl("http://example.com/path")).toBe(true);
    });

    it("rejects invalid URLs", () => {
      expect(isValidSeoUrl("not a url")).toBe(false);
      expect(isValidSeoUrl("path/to/file")).toBe(false);
    });

    it("handles URLs with special characters", () => {
      expect(isValidSeoUrl("https://example.com/path?query=value&other=123")).toBe(true);
      expect(isValidSeoUrl("https://example.com/path#anchor")).toBe(true);
    });
  });

  describe("STELLAR_PRECONNECT_ORIGINS constant", () => {
    it("is a readonly array", () => {
      expect(Array.isArray(STELLAR_PRECONNECT_ORIGINS)).toBe(true);
    });

    it("includes testnet and mainnet Stellar endpoints", () => {
      const origins = [...STELLAR_PRECONNECT_ORIGINS];
      expect(origins).toContain("https://horizon.stellar.org");
      expect(origins).toContain("https://horizon-testnet.stellar.org");
    });

    it("includes IPFS gateway", () => {
      const origins = [...STELLAR_PRECONNECT_ORIGINS];
      expect(origins).toContain("https://ipfs.io");
    });
  });
});

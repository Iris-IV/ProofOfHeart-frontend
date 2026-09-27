import { siteMetadata, getCanonicalUrl } from "@/lib/siteMetadata";
import {
  MIN_TOUCH_TARGET_SIZE_PX,
  isAccessibleTouchTarget,
  getTouchTargetStyles,
} from "@/lib/preferences";
import { trackWebVital } from "@/lib/analytics";
import { shouldPrefetchOnHover, CRITICAL_PREFETCH_ROUTES } from "@/i18n/routing";

describe("Issues #1580, #1579, #1578, #1577 verification", () => {
  describe("Issue #1577: Canonical URL tagging & SEO duplicate elimination", () => {
    it("declares canonical url in siteMetadata alternates", () => {
      expect(siteMetadata.alternates).toHaveProperty("canonical", "https://proofofheart.xyz/en");
      expect(siteMetadata.alternates?.languages).toHaveProperty("en", "https://proofofheart.xyz/en");
      expect(siteMetadata.alternates?.languages).toHaveProperty("es", "https://proofofheart.xyz/es");
      expect(siteMetadata.alternates?.languages).toHaveProperty("x-default", "https://proofofheart.xyz/en");
    });

    it("generates correct canonical URLs via getCanonicalUrl", () => {
      expect(getCanonicalUrl("/causes/123", "en")).toBe("https://proofofheart.xyz/en/causes/123");
      expect(getCanonicalUrl("explore", "es")).toBe("https://proofofheart.xyz/es/explore");
      expect(getCanonicalUrl("/", "en")).toBe("https://proofofheart.xyz/en");
    });
  });

  describe("Issue #1578: Touch Screen Tap Target Sizing Audit (Minimum 44x44px Targets)", () => {
    it("enforces minimum 44x44px target standard (WCAG 2.1)", () => {
      expect(MIN_TOUCH_TARGET_SIZE_PX).toBe(44);
      expect(isAccessibleTouchTarget(44, 44)).toBe(true);
      expect(isAccessibleTouchTarget(48, 50)).toBe(true);
      expect(isAccessibleTouchTarget(43, 44)).toBe(false);
      expect(isAccessibleTouchTarget(44, 40)).toBe(false);
    });

    it("returns correct touch target min dimensions style", () => {
      expect(getTouchTargetStyles()).toEqual({
        minWidth: "44px",
        minHeight: "44px",
      });
    });
  });

  describe("Issue #1579: Web Vitals Analytics Collector Pipeline", () => {
    it("dispatches Web Vitals metrics when plausible provider is available", () => {
      const plausible = jest.fn();
      window.plausible = plausible;

      trackWebVital({
        name: "INP",
        value: 150,
        rating: "good",
        id: "v-inp-1",
      });

      expect(plausible).toHaveBeenCalledWith("web_vitals", {
        props: expect.objectContaining({
          metric: "INP",
          value: 150,
          rating: "good",
          metricId: "v-inp-1",
        }),
      });
    });
  });

  describe("Issue #1580: Pre-Fetching Critical Routes on Link Hover", () => {
    it("identifies critical and detail routes for hover prefetching", () => {
      expect(CRITICAL_PREFETCH_ROUTES).toContain("/causes");
      expect(CRITICAL_PREFETCH_ROUTES).toContain("/explore");

      expect(shouldPrefetchOnHover("/causes/123")).toBe(true);
      expect(shouldPrefetchOnHover("/causes")).toBe(true);
      expect(shouldPrefetchOnHover("/explore")).toBe(true);
      expect(shouldPrefetchOnHover("/settings")).toBe(false);
    });
  });
});

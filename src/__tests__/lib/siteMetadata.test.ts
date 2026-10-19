import {
  siteMetadata,
  getCanonicalUrl,
  generatePageMetadata,
  getCanonicalMetadata,
} from "@/lib/siteMetadata";

describe("site metadata canonical URLs", () => {
  it("declares canonical url in siteMetadata alternates", () => {
    expect(siteMetadata.alternates).toHaveProperty("canonical", "https://proofofheart.xyz/en");
    expect(siteMetadata.alternates?.languages).toHaveProperty("en", "https://proofofheart.xyz/en");
    expect(siteMetadata.alternates?.languages).toHaveProperty("es", "https://proofofheart.xyz/es");
    expect(siteMetadata.alternates?.languages).toHaveProperty(
      "x-default",
      "https://proofofheart.xyz/en",
    );
  });

  it("generates correct canonical URLs via getCanonicalUrl", () => {
    expect(getCanonicalUrl("/causes/123", "en")).toBe("https://proofofheart.xyz/en/causes/123");
    expect(getCanonicalUrl("explore", "es")).toBe("https://proofofheart.xyz/es/explore");
    expect(getCanonicalUrl("/", "en")).toBe("https://proofofheart.xyz/en");
  });
});

describe("locale-specific metadata generation (#1565)", () => {
  describe("generatePageMetadata", () => {
    it("generates locale-specific canonical URL for English pages", () => {
      const metadata = generatePageMetadata({
        locale: "en",
        path: "/causes/42",
      });

      expect(metadata.alternates?.canonical).toBe("https://proofofheart.xyz/en/causes/42");
    });

    it("generates locale-specific canonical URL for Spanish pages", () => {
      const metadata = generatePageMetadata({
        locale: "es",
        path: "/explore",
      });

      expect(metadata.alternates?.canonical).toBe("https://proofofheart.xyz/es/explore");
    });

    it("includes hreflang alternates for both locales", () => {
      const metadata = generatePageMetadata({
        locale: "en",
        path: "/causes/42",
      });

      expect(metadata.alternates?.languages).toEqual({
        en: "https://proofofheart.xyz/en/causes/42",
        es: "https://proofofheart.xyz/es/causes/42",
        "x-default": "https://proofofheart.xyz/en/causes/42",
      });
    });

    it("prevents duplicate content by making each locale canonical to itself", () => {
      const enMetadata = generatePageMetadata({ locale: "en", path: "/about" });
      const esMetadata = generatePageMetadata({ locale: "es", path: "/about" });

      // English canonical points to /en/about, not /es/about
      expect(enMetadata.alternates?.canonical).toBe("https://proofofheart.xyz/en/about");
      // Spanish canonical points to /es/about, not /en/about
      expect(esMetadata.alternates?.canonical).toBe("https://proofofheart.xyz/es/about");
    });

    it("uses custom title and description when provided", () => {
      const metadata = generatePageMetadata({
        locale: "en",
        path: "/causes/42",
        title: "Clean Water Campaign",
        description: "Providing clean water to 500 families",
      });

      expect(metadata.title).toBe("Clean Water Campaign");
      expect(metadata.description).toBe("Providing clean water to 500 families");
    });

    it("falls back to site defaults when title/description not provided", () => {
      const metadata = generatePageMetadata({
        locale: "en",
        path: "/causes/42",
      });

      expect(metadata.title).toBe("ProofOfHeart");
      expect(metadata.description).toContain("decentralized launchpad");
    });

    it("sets OpenGraph locale based on language", () => {
      const enMetadata = generatePageMetadata({ locale: "en", path: "/" });
      const esMetadata = generatePageMetadata({ locale: "es", path: "/" });

      expect(enMetadata.openGraph?.locale).toBe("en_US");
      expect(esMetadata.openGraph?.locale).toBe("es_ES");
    });

    it("includes OpenGraph URL matching the canonical", () => {
      const metadata = generatePageMetadata({
        locale: "es",
        path: "/causes/100",
      });

      expect(metadata.openGraph?.url).toBe("https://proofofheart.xyz/es/causes/100");
      expect(metadata.alternates?.canonical).toBe("https://proofofheart.xyz/es/causes/100");
    });

    it("supports additional locale alternates", () => {
      const metadata = generatePageMetadata({
        locale: "en",
        path: "/causes/42",
        additionalLocales: {
          fr: "https://proofofheart.xyz/fr/causes/42",
        },
      });

      expect(metadata.alternates?.languages).toHaveProperty(
        "fr",
        "https://proofofheart.xyz/fr/causes/42",
      );
    });
  });

  describe("getCanonicalMetadata", () => {
    it("returns minimal metadata with canonical URL", () => {
      const metadata = getCanonicalMetadata("/causes/42", "en");

      expect(metadata.alternates?.canonical).toBe("https://proofofheart.xyz/en/causes/42");
    });

    it("includes hreflang alternates", () => {
      const metadata = getCanonicalMetadata("/explore", "es");

      expect(metadata.alternates?.languages).toEqual({
        en: "https://proofofheart.xyz/en/explore",
        es: "https://proofofheart.xyz/es/explore",
        "x-default": "https://proofofheart.xyz/en/explore",
      });
    });

    it("can be merged with existing metadata objects", () => {
      const baseMetadata = {
        title: "Custom Title",
        description: "Custom Description",
      };
      const canonicalMetadata = getCanonicalMetadata("/about", "en");

      const merged = { ...baseMetadata, ...canonicalMetadata };

      expect(merged.title).toBe("Custom Title");
      expect(merged.alternates?.canonical).toBe("https://proofofheart.xyz/en/about");
    });
  });
});

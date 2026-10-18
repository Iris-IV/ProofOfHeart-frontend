/**
 * #642 — Regression guards for the iMessage link preview.
 *
 * Apple's scraper drops the preview when `og:image` is an SVG, or when the
 * declared dimensions disagree with the delivered bytes. Both failure modes came
 * from hand-written `openGraph.images` entries, so these tests assert the tags
 * are produced by Next's `opengraph-image` file convention instead.
 */

// `next/og` constructs a `Response` at import time, which jsdom does not provide.
// The rendered pixels are not under test here — the exported route config is.
jest.mock("next/og", () => ({
  ImageResponse: class {},
}));

// The campaign page module imports these transitively heavy modules; stub them
// so only `generateMetadata` behavior is under test.
jest.mock("@/lib/contractClient", () => ({
  getCampaign: jest.fn(),
}));
jest.mock("next-intl/server", () => ({
  getTranslations: jest.fn(),
}));
jest.mock("@/app/[locale]/causes/[id]/CauseDetailClient", () => () => null);
// `src/lib/seo` imports this, and the real module pulls next-intl ESM that jest
// cannot transform — same stub sitemap.test.ts uses.
jest.mock("@/i18n/routing", () => ({
  routing: { locales: ["en", "es"], defaultLocale: "en" },
}));

import { siteMetadata as metadata } from "@/lib/siteMetadata";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/ogCard";
import { getCampaign } from "@/lib/contractClient";

const mockedGetCampaign = getCampaign as jest.MockedFunction<typeof getCampaign>;

describe("Open Graph image conventions", () => {
  it("renders cards at the 1200x630 PNG every scraper agrees on", () => {
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
    expect(OG_CONTENT_TYPE).toBe("image/png");
  });

  it("exposes the generated card as the site-wide default", async () => {
    const root = await import("@/app/opengraph-image");
    const twitter = await import("@/app/twitter-image");

    expect(root.size).toEqual(OG_SIZE);
    expect(root.contentType).toBe(OG_CONTENT_TYPE);
    expect(root.alt).toEqual(expect.any(String));
    // twitter:image must resolve to the same asset, not drift from og:image.
    expect(twitter.size).toEqual(root.size);
    expect(twitter.default).toBe(root.default);
  });
});

describe("campaign page metadata", () => {
  beforeEach(() => {
    mockedGetCampaign.mockReset();
  });

  it("leaves og:image to the generated card instead of the raw cover upload", async () => {
    mockedGetCampaign.mockResolvedValue({
      id: 1,
      title: "Plant trees for the future",
      description: "We plant trees in the city.",
      // A creator-supplied cover exists — it must NOT become a literal
      // openGraph.images entry, or the file-convention card is overridden.
      cover_image_url: "https://ipfs.io/ipfs/QmCoverHash",
    } as Awaited<ReturnType<typeof getCampaign>>);

    const page = await import("@/app/[locale]/causes/[id]/page");
    const md = await page.generateMetadata({ params: Promise.resolve({ id: "1", locale: "en" }) });

    expect(md.title).toContain("Plant trees for the future");
    expect(md.openGraph).not.toHaveProperty("images");
    expect(md.twitter).not.toHaveProperty("images");
    expect(md.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("declares no images for a campaign without a cover either", async () => {
    mockedGetCampaign.mockResolvedValue({
      id: 2,
      title: "No cover campaign",
      description: "A cause without imagery.",
    } as Awaited<ReturnType<typeof getCampaign>>);

    const page = await import("@/app/[locale]/causes/[id]/page");
    const md = await page.generateMetadata({ params: Promise.resolve({ id: "2", locale: "es" }) });

    expect(md.openGraph).not.toHaveProperty("images");
    expect(md.twitter).not.toHaveProperty("images");
  });

  it("falls back to a bare title when the campaign lookup fails", async () => {
    mockedGetCampaign.mockRejectedValue(new Error("rpc down"));

    const page = await import("@/app/[locale]/causes/[id]/page");
    const md = await page.generateMetadata({
      params: Promise.resolve({ id: "404", locale: "en" }),
    });

    expect(md).not.toHaveProperty("openGraph");
    expect(md.title).toBe("Campaign | ProofOfHeart");
  });
});

describe("root layout metadata", () => {
  it("declares no hand-written Open Graph image", () => {
    // A literal entry here overrides the file convention — which is how the
    // 512x512 SVG that broke iMessage got in.
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph).not.toHaveProperty("images");
    expect(metadata.twitter).not.toHaveProperty("images");
  });

  it("supplies the Apple-specific tags iMessage reads", () => {
    expect(metadata.appleWebApp).toMatchObject({
      capable: true,
      title: "ProofOfHeart",
    });
  });

  it("keeps a metadataBase so image URLs resolve absolutely", () => {
    // Relative og:image URLs are silently ignored by Apple and Slack.
    const base = metadata.metadataBase;
    expect(base).toBeInstanceOf(URL);
    expect((base as URL).protocol).toBe("https:");
  });

  it("still declares the large summary card for X", () => {
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });
});

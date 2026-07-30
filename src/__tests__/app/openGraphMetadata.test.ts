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

import { siteMetadata as metadata } from "@/lib/siteMetadata";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/ogCard";

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

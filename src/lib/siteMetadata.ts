import type { Metadata } from "next";

/**
 * Site-wide metadata for the locale layout.
 *
 * Lives here rather than inline in `layout.tsx` so it can be asserted on
 * directly — importing the layout drags in the whole component tree and
 * `next-intl`'s ESM server entry points, which the Jest transform does not
 * cover. The link-preview tags in #642 are exactly the kind of thing that
 * regresses silently, so they need a test that can actually run.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://proofofheart.xyz";

export const SITE_NAME = "ProofOfHeart";

export const SITE_DESCRIPTION =
  "A decentralized launchpad where the community validates causes and contributions are accounted for on-chain.";

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    languages: {
      en: `${SITE_URL}/en`,
      es: `${SITE_URL}/es`,
      "x-default": `${SITE_URL}/en`,
    },
  },
  // #642 — Apple's link preview scraper (iMessage, Mail, Notes) reads
  // `apple-mobile-web-app-title` for the name shown beside the preview card and
  // falls back to the raw hostname when it is missing. `capable` and the status
  // bar style also drive the standalone presentation once the site is added to
  // the Home Screen. Next emits all three from this block.
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
  // iOS Safari otherwise turns bare numbers (campaign ids, amounts) into tel: links.
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: `${SITE_URL}/en`,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    // #642 — `images` is intentionally absent. It previously pointed at a
    // 512x512 SVG, which Apple's scraper refuses to rasterise, so shared links
    // rendered with no image at all. `src/app/opengraph-image.tsx` now supplies
    // a 1200x630 PNG plus matching `og:image:width`/`height`/`type` to every
    // route that does not override it. Any literal entry here would take
    // precedence over that file convention and reintroduce the bug.
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

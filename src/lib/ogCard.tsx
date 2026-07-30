import type { ReactElement } from "react";

/**
 * Shared building blocks for the generated Open Graph / Twitter card images.
 *
 * #642 — Apple's link preview scraper (used by iMessage, Mail and Notes) will not
 * render an SVG referenced from `og:image`, and it silently drops the preview when
 * the declared `og:image:width`/`height` do not match the bytes it downloads. Every
 * card in the app is therefore rendered through `next/og` at a fixed 1200x630 PNG,
 * and the dimensions are emitted by Next's `opengraph-image` file convention rather
 * than hand-written into `generateMetadata`.
 */

/** The only dimensions Apple, Slack, X and Facebook all render without cropping. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_CONTENT_TYPE = "image/png";

export const BRAND_NAME = "ProofOfHeart";

/** Brand palette, mirrored from `globals.css` so the card matches the site. */
const COLORS = {
  background: "#fafafa",
  foreground: "#18181b",
  muted: "#71717a",
  accentFrom: "#ef4444",
  accentTo: "#ec4899",
} as const;

/** Truncate to `maxLen` characters, appending an ellipsis when shortened. */
export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + "…" : str;
}

/**
 * The default card used whenever a route has no richer content of its own — the
 * home page, listings, and the fallback when campaign lookup fails.
 */
export function BrandOgCard({
  title = BRAND_NAME,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}): ReactElement {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.background,
        fontFamily: "system-ui, sans-serif",
        padding: "80px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "140px",
          height: "140px",
          borderRadius: "36px",
          marginBottom: "40px",
          background: `linear-gradient(135deg, ${COLORS.accentFrom} 0%, ${COLORS.accentTo} 100%)`,
          color: "white",
          fontSize: "86px",
        }}
      >
        ♥
      </div>
      <div
        style={{
          display: "flex",
          fontSize: "68px",
          fontWeight: 700,
          color: COLORS.foreground,
          textAlign: "center",
          lineHeight: 1.15,
          maxWidth: "1000px",
        }}
      >
        {truncate(title, 70)}
      </div>
      {subtitle && (
        <div
          style={{
            display: "flex",
            fontSize: "34px",
            color: COLORS.muted,
            marginTop: "28px",
            textAlign: "center",
            maxWidth: "900px",
          }}
        >
          {truncate(subtitle, 110)}
        </div>
      )}
    </div>
  );
}

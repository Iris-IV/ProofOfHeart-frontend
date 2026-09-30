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

/**
 * #1575 — Cache policies for generated cards. Rendering a PNG with Satori is the
 * expensive part of the function, so every response tells the CDN how long it may
 * be served without re-invoking the renderer. `stale-while-revalidate` lets the
 * edge answer instantly while a fresh copy is rendered in the background.
 */
export const OG_CACHE_CONTROL = {
  /** Static brand card: content only changes on deploy. */
  brand: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  /** Campaign card: mirrors the route's `revalidate = 300` window. */
  campaign: "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
  /** Error fallback: keep short so a transient lookup failure heals quickly. */
  fallback: "public, max-age=0, s-maxage=60",
} as const;

/** `ImageResponse` options: fixed 1200x630 size plus an explicit cache policy. */
export function ogImageOptions(cacheControl: string) {
  return { ...OG_SIZE, headers: { "Cache-Control": cacheControl } };
}

/** Brand palette, mirrored from `globals.css` so the card matches the site. */
export const OG_COLORS = {
  background: "#fafafa",
  foreground: "#18181b",
  muted: "#71717a",
  accentFrom: "#ef4444",
  accentTo: "#ec4899",
} as const;

/**
 * Truncate to `maxLen` characters, appending an ellipsis when shortened.
 *
 * Counts and slices by Unicode code point so an emoji or other astral character
 * is never split into a lone surrogate (which renders as a broken glyph), and
 * drops trailing whitespace so the ellipsis never floats after a gap.
 */
export function truncate(str: string, maxLen: number): string {
  if (maxLen <= 0) return "";
  const chars = Array.from(str);
  if (chars.length <= maxLen) return str;
  return (
    chars
      .slice(0, maxLen - 1)
      .join("")
      .trimEnd() + "…"
  );
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
        backgroundColor: OG_COLORS.background,
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
          background: `linear-gradient(135deg, ${OG_COLORS.accentFrom} 0%, ${OG_COLORS.accentTo} 100%)`,
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
          color: OG_COLORS.foreground,
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
            color: OG_COLORS.muted,
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

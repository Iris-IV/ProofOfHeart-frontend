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
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(circle at top left, rgba(251,146,60,0.24), transparent 30%), radial-gradient(circle at bottom right, rgba(168,85,247,0.18), transparent 28%), linear-gradient(135deg, #fff7ed 0%, #ffffff 42%, #fdf2f8 100%)`,
        fontFamily: "system-ui, sans-serif",
        padding: "64px",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "1040px",
          maxWidth: "calc(100% - 32px)",
          alignItems: "center",
          justifyContent: "center",
          padding: "42px 52px",
          borderRadius: "40px",
          border: "1px solid rgba(255,255,255,0.7)",
          background: "rgba(255,255,255,0.66)",
          boxShadow: "0 30px 80px -30px rgba(15,23,42,0.35)",
          backdropFilter: "blur(18px)",
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
            marginRight: "38px",
            background: `linear-gradient(135deg, ${OG_COLORS.accentFrom} 0%, ${OG_COLORS.accentTo} 100%)`,
            color: "white",
            fontSize: "86px",
            boxShadow: "0 22px 50px -18px rgba(236,72,153,0.7)",
          }}
        >
          ♥
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            textAlign: "left",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "68px",
              fontWeight: 700,
              color: OG_COLORS.foreground,
              lineHeight: 1.1,
              maxWidth: "780px",
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
                marginTop: "18px",
                maxWidth: "780px",
                lineHeight: 1.25,
              }}
            >
              {truncate(subtitle, 110)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

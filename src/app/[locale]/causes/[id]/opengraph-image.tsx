import { ImageResponse } from "next/og";
import { getCampaign } from "@/lib/contractClient";
import { CATEGORY_LABELS } from "@/types";
import { stroopsToXlmNumber } from "@/lib/stellarAmount";
import { BrandOgCard, OG_CONTENT_TYPE, OG_SIZE, truncate } from "@/lib/ogCard";
import { absoluteUrl } from "@/lib/seo";
import { isAllowedCampaignImageUrl } from "@/lib/campaignMedia";

export const runtime = "edge";
export const revalidate = 300; // Cache for 5 minutes
export const alt = "Campaign details on ProofOfHeart";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * #642 — Every preview is a 1200x630 PNG generated with `next/og`; Apple, Slack,
 * X and Facebook all refuse SVGs and drop previews whose declared dimensions
 * don't match the delivered bytes. The creator's cover is therefore *fetched
 * into* this renderer (never referenced as a raw `og:image`), and only when it
 * survives the checks below — otherwise the card degrades to the text layout.
 */

/** Reject oversized uploads before they can exhaust the edge function. */
const MAX_COVER_BYTES = 4 * 1024 * 1024;
const COVER_FETCH_TIMEOUT_MS = 8_000;

/** Magic-byte sniff: only raster formats Satori can rasterize. */
function sniffImageType(bytes: Uint8Array): string | null {
  const head = String.fromCharCode(...bytes.subarray(0, 12));
  if (head.startsWith("\u0089PNG\r\n\u001a\n")) return "image/png";
  if (head.startsWith("\u00ff\u00d8\u00ff")) return "image/jpeg";
  if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Base64-encode without depending on Node's `Buffer` (edge-safe). */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Fetch the cover as a base64 data URI Satori can embed synchronously. Returns
 * null on any failure (unreachable host, non-raster content, too large, timeout)
 * so the caller falls back to the text-only card instead of 500ing the preview.
 */
async function fetchCoverAsDataUri(url: string): Promise<string | null> {
  // Server-side fetch of a creator-supplied URL — restrict to the allow-list
  // that also drives `next.config` remotePatterns (SSRF guard).
  if (!isAllowedCampaignImageUrl(url)) return null;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(COVER_FETCH_TIMEOUT_MS),
      // Never follow redirects: an allow-listed host could 302 to an internal
      // address, which would turn this fetch into an SSRF vector.
      redirect: "error",
    });
    if (!res.ok) return null;

    // Fail fast on oversized bodies when the server declares the size, before
    // reading the whole payload into the edge function.
    const contentLength = Number(res.headers.get("content-length"));
    if (contentLength > MAX_COVER_BYTES) return null;

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_COVER_BYTES) return null;

    const type = sniffImageType(bytes);
    if (!type) return null;

    return `data:${type};base64,${bytesToBase64(bytes)}`;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const safeLocale = locale === "es" ? "es" : "en";

  function fmtNumber(n: number): string {
    return new Intl.NumberFormat(safeLocale, { maximumFractionDigits: 2 }).format(n);
  }

  try {
    const campaign = await getCampaign(Number(id));

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const raised = stroopsToXlmNumber(campaign.amount_raised);
    const goal = stroopsToXlmNumber(campaign.funding_goal);
    const fundingPct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
    const categoryLabel = CATEGORY_LABELS[campaign.category] ?? "Other";

    const cover = campaign.cover_image_url
      ? await fetchCoverAsDataUri(absoluteUrl(campaign.cover_image_url))
      : null;

    // The cover panel leaves a narrower column, so cap the title sooner — Satori
    // has no line-clamping recipe, so truncation is the overflow safeguard.
    const title = truncate(campaign.title || "Untitled Campaign", cover ? 60 : 80);

    const header = (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              backgroundColor: "#fbbf24",
              color: "#78350f",
              padding: "8px 20px",
              borderRadius: "12px",
              fontSize: "24px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {categoryLabel}
          </div>
          {campaign.is_verified && (
            <div
              style={{
                backgroundColor: "#10b981",
                color: "white",
                padding: "8px 20px",
                borderRadius: "12px",
                fontSize: "24px",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
              }}
            >
              ✓ Verified
            </div>
          )}
        </div>

        <h1
          style={{
            fontSize: cover ? "52px" : "64px",
            fontWeight: "bold",
            color: "#18181b",
            lineHeight: 1.2,
            margin: 0,
            maxWidth: cover ? "100%" : "1000px",
            wordBreak: "break-word",
          }}
        >
          {title}
        </h1>
      </div>
    );

    const stats = (
      <div style={{ display: "flex", gap: "40px", width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              fontSize: "28px",
              color: "#71717a",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Raised
          </div>
          <div style={{ fontSize: "56px", fontWeight: "bold", color: "#18181b" }}>
            {fmtNumber(raised)} XLM
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              fontSize: "28px",
              color: "#71717a",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Goal
          </div>
          <div style={{ fontSize: "56px", fontWeight: "bold", color: "#18181b" }}>
            {fmtNumber(goal)} XLM
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              fontSize: "28px",
              color: "#71717a",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Progress
          </div>
          <div style={{ fontSize: "56px", fontWeight: "bold", color: "#10b981" }}>
            {fundingPct}%
          </div>
        </div>
      </div>
    );

    const footer = (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontSize: "32px",
          fontWeight: "bold",
          color: "#18181b",
        }}
      >
        <span style={{ fontSize: "48px" }}>💜</span>
        ProofOfHeart
      </div>
    );

    const layout = cover ? (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          height: "100%",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            minWidth: 0,
            height: "100%",
            paddingRight: "48px",
          }}
        >
          {header}
          {stats}
          {footer}
        </div>
        {/* Satori has no `object-fit`, so crop via background-size: cover. */}
        <div
          style={{
            display: "flex",
            width: "470px",
            flexShrink: 0,
            height: "100%",
            borderRadius: "28px",
            overflow: "hidden",
            backgroundImage: `url(${cover})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
      </div>
    ) : (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          height: "100%",
          width: "100%",
        }}
      >
        {header}
        {stats}
        {footer}
      </div>
    );

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          backgroundColor: "#fafafa",
          padding: "80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {layout}
      </div>,
      {
        ...size,
      },
    );
  } catch {
    // Campaign lookup failed — still return a valid 1200x630 PNG rather than a 500,
    // otherwise the scraper falls back to no preview at all.
    return new ImageResponse(
      <BrandOgCard title="ProofOfHeart" subtitle="Blockchain-powered crowdfunding" />,
      { ...size },
    );
  }
}

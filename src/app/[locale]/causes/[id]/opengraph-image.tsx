import { ImageResponse } from "next/og";
import { getCampaign } from "@/lib/contractClient";
import { CATEGORY_LABELS } from "@/types";
import { stroopsToXlmNumber } from "@/lib/stellarAmount";
import { BrandOgCard, OG_CONTENT_TYPE, OG_SIZE, truncate } from "@/lib/ogCard";

export const runtime = "edge";
export const revalidate = 300; // Cache for 5 minutes
export const alt = "Campaign details on ProofOfHeart";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

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
    const title = truncate(campaign.title || "Untitled Campaign", 80);

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          backgroundColor: "#fafafa",
          padding: "80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
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
              fontSize: "64px",
              fontWeight: "bold",
              color: "#18181b",
              lineHeight: 1.2,
              margin: 0,
              maxWidth: "1000px",
              wordBreak: "break-word",
            }}
          >
            {title}
          </h1>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            gap: "40px",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
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
            <div
              style={{
                fontSize: "56px",
                fontWeight: "bold",
                color: "#18181b",
              }}
            >
              {fmtNumber(raised)} XLM
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
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
            <div
              style={{
                fontSize: "56px",
                fontWeight: "bold",
                color: "#18181b",
              }}
            >
              {fmtNumber(goal)} XLM
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
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
            <div
              style={{
                fontSize: "56px",
                fontWeight: "bold",
                color: "#10b981",
              }}
            >
              {fundingPct}%
            </div>
          </div>
        </div>

        {/* Footer */}
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

import { getTranslations } from "next-intl/server";
import { absoluteUrl, buildAlternates, buildCauseJsonLd } from "@/lib/seo";
import { getCampaign } from "@/lib/contractClient";
import CauseDetailClient from "./CauseDetailClient";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id, locale } = await params;

  try {
    const campaign = await getCampaign(Number(id));

    if (!campaign) {
      return {
        title: "Campaign | ProofOfHeart",
        alternates: buildAlternates(`/causes/${id}`, locale),
      };
    }

    const description = campaign.description.slice(0, 160);

    // #642 — Deliberately no `openGraph.images` / `twitter.images` here. This
    // route ships `opengraph-image.tsx` / `twitter-image.tsx`, whose file
    // conventions make Next emit og:image:type/width/height that match the
    // delivered 1200x630 PNG. A literal entry instead points scrapers at the raw
    // creator-uploaded cover — no declared dimensions, arbitrary format — which
    // is exactly the failure mode #642 ruled out (Apple drops such previews).
    // The cover still appears in shares: the generated renderer fetches it and
    // embeds it into the card.
    return {
      title: `${campaign.title} | ProofOfHeart`,
      description,
      openGraph: {
        title: campaign.title,
        description,
        type: "website",
        siteName: "ProofOfHeart",
        locale,
        url: absoluteUrl(`/${locale}/causes/${id}`),
      },
      twitter: {
        card: "summary_large_image",
        title: campaign.title,
        description,
      },
      alternates: buildAlternates(`/causes/${id}`, locale),
    };
  } catch {
    return {
      title: "Campaign | ProofOfHeart",
      alternates: buildAlternates(`/causes/${id}`, locale),
    };
  }
}

export default async function Page({ params }: Props) {
  const { id, locale } = await params;

  const [campaign, t] = await Promise.all([
    getCampaign(Number(id)),
    getTranslations({ locale, namespace: "CauseJsonLd" }),
  ]);

  const jsonLd = campaign
    ? buildCauseJsonLd(campaign, locale, {
        donateActionName: t("donateActionName", { title: campaign.title }),
        fundingGoalLabel: t("fundingGoalLabel"),
        amountRaisedLabel: t("amountRaisedLabel"),
        deadlineLabel: t("deadlineLabel"),
      })
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <CauseDetailClient id={id} />
    </>
  );
}

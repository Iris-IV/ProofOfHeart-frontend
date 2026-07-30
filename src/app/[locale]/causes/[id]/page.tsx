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

    // #642 — `images` is deliberately omitted here. It used to point at
    // `campaign.cover_image_url` while declaring a hard-coded 1200x630, but cover
    // images are arbitrary user uploads on IPFS/Arweave: wrong aspect ratio, often
    // SVG or WebP, and behind a gateway Apple's scraper frequently cannot fetch
    // within its timeout. iMessage drops the preview when the bytes disagree with
    // the declared dimensions. Letting the sibling `opengraph-image.tsx` /
    // `twitter-image.tsx` conventions supply the tags guarantees a self-hosted
    // 1200x630 PNG with matching `og:image:width`/`height`/`type`.
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

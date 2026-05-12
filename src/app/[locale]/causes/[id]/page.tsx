import { buildAlternates } from "@/lib/seo";
import { getCampaign } from "@/lib/contractClient";
import { CATEGORY_LABELS, stroopsToXlm } from "@/types";
import CauseDetailClient from "./CauseDetailClient";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id, locale } = await params;
  
  try {
    const campaign = await getCampaign(Number(id));
    
    if (!campaign) {
      return {
        title: 'Campaign | ProofOfHeart',
        alternates: buildAlternates(`/causes/${id}`),
      };
    }
    
    const raised = stroopsToXlm(campaign.amount_raised);
    const goal = stroopsToXlm(campaign.funding_goal);
    const categoryLabel = CATEGORY_LABELS[campaign.category] ?? 'Other';
    
    return {
      title: `${campaign.title} | ProofOfHeart`,
      description: campaign.description.slice(0, 160),
      openGraph: {
        title: campaign.title,
        description: campaign.description.slice(0, 160),
        type: 'website',
        images: [
          {
            url: `/causes/${id}/opengraph-image`,
            width: 1200,
            height: 630,
            alt: campaign.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: campaign.title,
        description: campaign.description.slice(0, 160),
        images: [`/causes/${id}/opengraph-image`],
      },
      alternates: buildAlternates(`/causes/${id}`),
    };
  } catch (error) {
    return {
      title: 'Campaign | ProofOfHeart',
      alternates: buildAlternates(`/causes/${id}`),
    };
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <CauseDetailClient id={id} />;
}

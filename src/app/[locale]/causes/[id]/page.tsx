import { absoluteUrl, buildAlternates } from "@/lib/seo";
import { getCampaign } from "@/lib/contractClient";
import CauseDetailClient from "./CauseDetailClient";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id, locale } = await params;
  
  try {
    const campaign = await getCampaign(Number(id));
    
    if (!campaign) {
      return {
        title: 'Campaign | ProofOfHeart',
        alternates: buildAlternates(`/causes/${id}`, locale),
      };
    }
    
    const description = campaign.description.slice(0, 160);
    const imageUrl = campaign.cover_image_url
      ? absoluteUrl(campaign.cover_image_url)
      : absoluteUrl(`/${locale}/causes/${id}/opengraph-image`);
    
    return {
      title: `${campaign.title} | ProofOfHeart`,
      description,
      openGraph: {
        title: campaign.title,
        description,
        type: 'website',
        siteName: 'ProofOfHeart',
        url: absoluteUrl(`/${locale}/causes/${id}`),
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: campaign.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: campaign.title,
        description,
        images: [imageUrl],
      },
      alternates: buildAlternates(`/causes/${id}`, locale),
    };
  } catch (error) {
    return {
      title: 'Campaign | ProofOfHeart',
      alternates: buildAlternates(`/causes/${id}`, locale),
    };
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <CauseDetailClient id={id} />;
}

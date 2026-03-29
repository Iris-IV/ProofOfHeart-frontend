import { Metadata, ResolvingMetadata } from 'next';
import { getCampaign } from '../../../lib/contractClient';
import { stroopsToXlm } from '../../../types';
import CauseDetailClient from './CauseDetailClient';

interface PageProps {
  params: { id: string };
}

export async function generateMetadata(
  { params }: PageProps,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return {};

  try {
    const campaign = await getCampaign(id);
    if (!campaign) return { title: 'Cause Not Found | Proof of Heart' };

    const raised = stroopsToXlm(campaign.amount_raised);
    const goal = stroopsToXlm(campaign.funding_goal);
    const description = `${campaign.description.slice(0, 160)}... Raised ${raised} XLM of ${goal} XLM goal.`;

    return {
      title: `${campaign.title} | Proof of Heart`,
      description,
      openGraph: {
        title: campaign.title,
        description,
        url: `https://proofofheart.io/causes/${params.id}`,
        siteName: 'Proof of Heart',
        images: [
          {
            url: `https://proofofheart.io/api/og/campaign/${params.id}`,
            width: 1200,
            height: 630,
            alt: campaign.title,
          },
        ],
        locale: 'en_US',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: campaign.title,
        description,
        images: [`https://proofofheart.io/api/og/campaign/${params.id}`],
      },
    };
  } catch (err) {
    console.error('Metadata error:', err);
    return { title: 'Proof of Heart | Campaign' };
  }
}

export default function Page({ params }: PageProps) {
  return <CauseDetailClient id={params.id} />;
}

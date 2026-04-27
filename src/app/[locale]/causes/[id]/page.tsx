import { Metadata } from 'next';
import CauseDetailClient from './CauseDetailClient';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  return {
    title: `Cause #${id} | ProofOfHeart`,
    description: `Support cause #${id} on ProofOfHeart. View details, vote, and contribute.`,
    alternates: {
      canonical: `https://proofofheart.org/${locale}/causes/${id}`,
    },
    openGraph: {
      title: `Cause #${id} | ProofOfHeart`,
      description: `Support cause #${id} on ProofOfHeart.`,
      url: `https://proofofheart.org/${locale}/causes/${id}`,
      siteName: 'ProofOfHeart',
      locale,
      type: 'website',
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <CauseDetailClient id={id} />;
}
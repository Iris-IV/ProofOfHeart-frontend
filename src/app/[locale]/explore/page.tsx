import { Metadata } from 'next';
import ExploreClient from './ExploreClient';

export const metadata: Metadata = {
  title: 'Explore Causes | ProofOfHeart',
  description: 'Browse and explore all causes on ProofOfHeart by category, status and funding.',
  openGraph: {
    title: 'Explore Causes | ProofOfHeart',
    description: 'Browse and explore all causes on ProofOfHeart.',
    siteName: 'ProofOfHeart',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore Causes | ProofOfHeart',
    description: 'Browse and explore all causes on ProofOfHeart.',
  },
};

export default function Page() {
  return <ExploreClient />;
}
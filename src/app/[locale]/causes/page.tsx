import { Metadata } from 'next';
import CausesClient from './CausesClient';

export const metadata: Metadata = {
  title: 'Browse Causes | ProofOfHeart',
  description: 'Discover and support community-validated causes on ProofOfHeart.',
  openGraph: {
    title: 'Browse Causes | ProofOfHeart',
    description: 'Discover and support community-validated causes on ProofOfHeart.',
    siteName: 'ProofOfHeart',
    type: 'website',
  },
};

export default function Page() {
  return <CausesClient />;
}
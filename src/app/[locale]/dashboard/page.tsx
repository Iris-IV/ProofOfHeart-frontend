import { Metadata } from 'next';
import DashboardClient from './DashboardClient';

export const metadata: Metadata = {
  title: 'My Dashboard | ProofOfHeart',
  description: 'View your contributions, campaigns and wallet activity on ProofOfHeart.',
  openGraph: {
    title: 'My Dashboard | ProofOfHeart',
    description: 'View your contributions and campaigns on ProofOfHeart.',
    siteName: 'ProofOfHeart',
    type: 'website',
  },
};

export default function Page() {
  return <DashboardClient />;
}
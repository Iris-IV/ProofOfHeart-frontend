import { Metadata } from 'next';
import AdminClient from './AdminClient';

export const metadata: Metadata = {
  title: 'Admin Dashboard | ProofOfHeart',
  description: 'Admin control panel for ProofOfHeart platform management.',
  openGraph: {
    title: 'Admin Dashboard | ProofOfHeart',
    description: 'Admin control panel for ProofOfHeart.',
    siteName: 'ProofOfHeart',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Admin Dashboard | ProofOfHeart',
    description: 'Admin control panel for ProofOfHeart.',
  },
};

export default function Page() {
  return <AdminClient />;
}
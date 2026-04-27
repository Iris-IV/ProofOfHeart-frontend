import { Metadata } from 'next';
import NewCauseClient from './NewCauseClient';

export const metadata: Metadata = {
  title: 'Create a Cause | ProofOfHeart',
  description: 'Start a new fundraising cause on ProofOfHeart and get community validation.',
  openGraph: {
    title: 'Create a Cause | ProofOfHeart',
    description: 'Start a new fundraising cause on ProofOfHeart.',
    siteName: 'ProofOfHeart',
    type: 'website',
  },
};

export default function Page() {
  return <NewCauseClient />;
}
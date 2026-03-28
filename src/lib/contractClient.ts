/**
 * Soroban contract service layer.
 *
 * Set NEXT_PUBLIC_USE_MOCKS=true in .env.local to serve mock data during
 * development while the real contract client (issue #14) is not yet wired up.
 *
 * When issue #14 lands, replace the TODO stubs below with the real
 * SorobanContractClient calls — no other files need to change.
 */

import { Campaign } from '../types';

const USE_MOCKS =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

// ---------------------------------------------------------------------------
// Mock data (mirrors mockCauses.ts but typed as Campaign)
// ---------------------------------------------------------------------------

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 1,
    title: 'Clean Water for Rural Communities',
    description:
      'Providing clean water access to 500 families in rural areas affected by drought. This cause aims to install sustainable water filtration systems and educate communities on water conservation techniques.',
    creator: 'GABC123456789012345678901234567890123456789012345678901234567890',
    createdAt: 1705276800, // 2024-01-15
    upvotes: 45,
    downvotes: 12,
    totalVotes: 57,
    status: 'approved',
    category: 'environment',
    targetAmount: 10000,
    currentAmount: 6500,
  },
  {
    id: 2,
    title: 'Education Technology for Underprivileged Children',
    description:
      'Equipping schools in low-income areas with tablets and educational software to bridge the digital divide and provide equal learning opportunities to every child.',
    creator: 'GDEF123456789012345678901234567890123456789012345678901234567890',
    createdAt: 1705708800, // 2024-01-20
    upvotes: 23,
    downvotes: 8,
    totalVotes: 31,
    status: 'pending',
    category: 'education',
    targetAmount: 5000,
    currentAmount: 1200,
  },
  {
    id: 3,
    title: 'Medical Supplies for Remote Clinics',
    description:
      'Delivering essential medical supplies and equipment to clinics in remote areas with limited healthcare access, ensuring that every person can receive basic medical attention.',
    creator: 'GHIJ123456789012345678901234567890123456789012345678901234567890',
    createdAt: 1706140800, // 2024-01-25
    upvotes: 67,
    downvotes: 15,
    totalVotes: 82,
    status: 'approved',
    category: 'healthcare',
    targetAmount: 15000,
    currentAmount: 8900,
  },
  {
    id: 4,
    title: 'Reforestation of Degraded Lands',
    description:
      'Planting 100,000 trees across deforested regions to restore ecosystems, improve air quality, and provide sustainable livelihoods for local farming communities.',
    creator: 'GKLM123456789012345678901234567890123456789012345678901234567890',
    createdAt: 1706745600, // 2024-02-01
    upvotes: 38,
    downvotes: 5,
    totalVotes: 43,
    status: 'approved',
    category: 'environment',
    targetAmount: 8000,
    currentAmount: 3200,
  },
  {
    id: 5,
    title: 'Mental Health Support for Youth',
    description:
      'Building free counselling and mental health resource centers for teenagers and young adults in underserved urban neighborhoods.',
    creator: 'GNOP123456789012345678901234567890123456789012345678901234567890',
    createdAt: 1707523200, // 2024-02-10
    upvotes: 14,
    downvotes: 3,
    totalVotes: 17,
    status: 'pending',
    category: 'healthcare',
    targetAmount: 6000,
    currentAmount: 900,
  },
  {
    id: 6,
    title: 'Solar Energy for Off-Grid Villages',
    description:
      'Installing solar panels and battery storage in 20 villages currently without electricity, enabling access to light, communication, and refrigeration for food/medicine.',
    creator: 'GQRS123456789012345678901234567890123456789012345678901234567890',
    createdAt: 1707955200, // 2024-02-15
    upvotes: 91,
    downvotes: 7,
    totalVotes: 98,
    status: 'approved',
    category: 'environment',
    targetAmount: 20000,
    currentAmount: 17500,
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the total number of campaigns registered on the contract.
 */
export async function getCampaignCount(): Promise<number> {
  if (USE_MOCKS) return MOCK_CAMPAIGNS.length;

  // TODO(#14): Replace with real Soroban contract call, e.g.:
  // const client = new ProofOfHeartClient({ contractId: CONTRACT_ID, rpc: RPC_URL });
  // const result = await client.get_campaign_count();
  // return Number(result);
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}

/**
 * Fetches a single campaign by its numeric ID.
 * Returns null when the contract confirms no campaign exists for that ID.
 */
export async function getCampaign(id: number): Promise<Campaign | null> {
  if (USE_MOCKS) return MOCK_CAMPAIGNS.find((c) => c.id === id) ?? null;

  // TODO(#14): Replace with real Soroban contract call, e.g.:
  // const client = new ProofOfHeartClient({ contractId: CONTRACT_ID, rpc: RPC_URL });
  // const result = await client.get_campaign({ id });
  // return result ?? null;
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}

/**
 * Fetches all campaigns by querying the count then fetching each one.
 * Returns an empty array when there are no campaigns.
 */
export async function getAllCampaigns(): Promise<Campaign[]> {
  if (USE_MOCKS) return [...MOCK_CAMPAIGNS];

  // TODO(#14): Replace with real Soroban contract call, e.g.:
  // const count = await getCampaignCount();
  // const results = await Promise.all(
  //   Array.from({ length: count }, (_, i) => getCampaign(i + 1))
  // );
  // return results.filter((c): c is Campaign => c !== null);
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}

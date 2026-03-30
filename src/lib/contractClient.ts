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
    createdAt: 1705276800,
    upvotes: 45,
    downvotes: 12,
    totalVotes: 57,
    status: 'approved',
    category: 'environment',
    targetAmount: 10000,
    currentAmount: 6500,
    fundsWithdrawn: false,
  },
  {
    id: 2,
    title: 'Education Technology for Underprivileged Children',
    description:
      'Equipping schools in low-income areas with tablets and educational software to bridge the digital divide and provide equal learning opportunities to every child.',
    creator: 'GDEF123456789012345678901234567890123456789012345678901234567890',
    createdAt: 1705708800,
    upvotes: 23,
    downvotes: 8,
    totalVotes: 31,
    status: 'pending',
    category: 'education',
    targetAmount: 5000,
    currentAmount: 1200,
    fundsWithdrawn: false,
  },
  {
    id: 3,
    title: 'Medical Supplies for Remote Clinics',
    description:
      'Delivering essential medical supplies and equipment to clinics in remote areas with limited healthcare access, ensuring that every person can receive basic medical attention.',
    creator: 'GHIJ123456789012345678901234567890123456789012345678901234567890',
    createdAt: 1706140800,
    upvotes: 67,
    downvotes: 15,
    totalVotes: 82,
    status: 'approved',
    category: 'healthcare',
    targetAmount: 15000,
    currentAmount: 8900,
    fundsWithdrawn: false,
  },
  {
    id: 4,
    title: 'Reforestation of Degraded Lands',
    description:
      'Planting 100,000 trees across deforested regions to restore ecosystems, improve air quality, and provide sustainable livelihoods for local farming communities.',
    creator: 'GKLM123456789012345678901234567890123456789012345678901234567890',
    createdAt: 1706745600,
    upvotes: 38,
    downvotes: 5,
    totalVotes: 43,
    status: 'approved',
    category: 'environment',
    targetAmount: 8000,
    currentAmount: 3200,
    fundsWithdrawn: false,
  },
  {
    id: 5,
    title: 'Mental Health Support for Youth',
    description:
      'Building free counselling and mental health resource centers for teenagers and young adults in underserved urban neighborhoods.',
    creator: 'GNOP123456789012345678901234567890123456789012345678901234567890',
    createdAt: 1707523200,
    upvotes: 14,
    downvotes: 3,
    totalVotes: 17,
    status: 'pending',
    category: 'healthcare',
    targetAmount: 6000,
    currentAmount: 900,
    fundsWithdrawn: false,
  },
  {
    id: 6,
    title: 'Solar Energy for Off-Grid Villages',
    description:
      'Installing solar panels and battery storage in 20 villages currently without electricity, enabling access to light, communication, and refrigeration for food/medicine.',
    creator: 'GQRS123456789012345678901234567890123456789012345678901234567890',
    createdAt: 1707955200,
    upvotes: 91,
    downvotes: 7,
    totalVotes: 98,
    status: 'approved',
    category: 'environment',
    targetAmount: 20000,
    currentAmount: 17500,
    fundsWithdrawn: false,
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
  // try {
  //   const client = new ProofOfHeartClient({ contractId: CONTRACT_ID, rpc: RPC_URL });
  //   const result = await client.get_campaign_count();
  //   return Number(result);
  // } catch (err) {
  //   throw new Error(parseContractError(err));
  // }
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
  // try {
  //   const client = new ProofOfHeartClient({ contractId: CONTRACT_ID, rpc: RPC_URL });
  //   const result = await client.get_campaign({ id });
  //   return result ?? null;
  // } catch (err) {
  //   throw new Error(parseContractError(err));
  // }
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
  // try {
  //   const count = await getCampaignCount();
  //   const results = await Promise.all(
  //     Array.from({ length: count }, (_, i) => getCampaign(i + 1))
  //   );
  //   return results.filter((c): c is Campaign => c !== null);
  // } catch (err) {
  //   throw new Error(parseContractError(err));
  // }
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}

/**
 * Cancels an active campaign. Requires the connected wallet to be the
 * campaign creator (`creator.require_auth()` on-chain).
 *
 * Only valid when `campaign.fundsWithdrawn === false`. The caller is
 * responsible for verifying this before showing the cancel button.
 *
 * After a successful call, contributors may call `claimRefund` to recover
 * their contributions.
 *
 * @param campaignId - Numeric ID of the campaign to cancel.
 * @param creatorAddress - Public key of the connected wallet (must match creator).
 */
export async function cancelCampaign(
  campaignId: number,
  creatorAddress: string
): Promise<void> {
  if (USE_MOCKS) {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 800));

    const campaign = MOCK_CAMPAIGNS.find((c) => c.id === campaignId);
    if (!campaign) throw new Error('Campaign not found.');
    if (campaign.creator !== creatorAddress) throw new Error('Not authorized.');
    if (campaign.fundsWithdrawn) throw new Error('Funds already withdrawn.');

    // Mutate mock state so the optimistic update in the page is consistent
    // when USE_MOCKS is true and the page re-fetches.
    campaign.status = 'cancelled';
    return;
  }

  // TODO(#14): Replace with real Soroban contract call, e.g.:
  // try {
  //   const client = new ProofOfHeartClient({ contractId: CONTRACT_ID, rpc: RPC_URL });
  //   await client.cancel_campaign({ campaign_id: campaignId });
  // } catch (err) {
  //   throw new Error(parseContractError(err));
  // }
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}

/**
 * Claims a refund for a contributor on a cancelled (or failed) campaign.
 * Requires the connected wallet to be a contributor (`contributor.require_auth()`
 * on-chain).
 *
 * Only callable after the campaign has been cancelled or has failed to reach
 * its funding goal by the deadline.
 *
 * @param campaignId - Numeric ID of the campaign.
 * @param contributorAddress - Public key of the contributor claiming the refund.
 */
export async function claimRefund(
  campaignId: number
): Promise<void> {
  if (USE_MOCKS) {
    await new Promise((resolve) => setTimeout(resolve, 800));

    const campaign = MOCK_CAMPAIGNS.find((c) => c.id === campaignId);
    if (!campaign) throw new Error('Campaign not found.');
    if (campaign.status !== 'cancelled') {
      throw new Error('Campaign is not cancelled. Refunds are not yet available.');
    }
    // In mock mode, assume any wallet that calls this has a contribution.
    return;
  }

  // TODO(#14): Replace with real Soroban contract call, e.g.:
  // try {
  //   const client = new ProofOfHeartClient({ contractId: CONTRACT_ID, rpc: RPC_URL });
  //   await client.claim_refund({ campaign_id: campaignId, contributor: contributorAddress });
  // } catch (err) {
  //   throw new Error(parseContractError(err));
  // }
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}
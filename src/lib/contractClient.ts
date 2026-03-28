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
// When issue #14 lands, import ContractErrorException and parseContractError from
// '../utils/contractErrors' to wrap raw Soroban SDK errors before re-throwing.

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
    deadline: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days from now
    fundingGoal: 10000,
    amountRaised: 6500,
    isCancelled: false,
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
    deadline: Math.floor(Date.now() / 1000) - 86400, // Deadline passed (yesterday)
    fundingGoal: 5000,
    amountRaised: 1200,
    isCancelled: false,
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
    deadline: Math.floor(Date.now() / 1000) + 86400 * 60, // 60 days from now
    fundingGoal: 15000,
    amountRaised: 8900,
    isCancelled: false,
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
    deadline: Math.floor(Date.now() / 1000) + 86400 * 45, // 45 days from now
    fundingGoal: 8000,
    amountRaised: 3200,
    isCancelled: true, // Cancelled — refund eligible
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
    deadline: Math.floor(Date.now() / 1000) + 86400 * 20, // 20 days from now
    fundingGoal: 6000,
    amountRaised: 900,
    isCancelled: false,
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
    deadline: Math.floor(Date.now() / 1000) + 86400 * 90, // 90 days from now
    fundingGoal: 20000,
    amountRaised: 17500,
    isCancelled: false,
  },
];

// Mock contribution amounts per connected wallet (keyed by "campaignId:contributor")
const MOCK_CONTRIBUTIONS: Record<string, number> = {};
// Track which contributors have already claimed refunds
const MOCK_REFUNDED: Set<string> = new Set();

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
  //   // Re-throw as ContractErrorException when the contract returns a known code,
  //   // or as a plain Error with a human-readable message for unexpected failures.
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

// ---------------------------------------------------------------------------
// Contribution / Refund API
// ---------------------------------------------------------------------------

/**
 * Returns the contribution amount (in XLM) for a given contributor on a
 * specific campaign. Returns 0 when the contributor has no contribution.
 */
export async function getContribution(
  campaignId: number,
  contributor: string
): Promise<number> {
  if (USE_MOCKS) {
    // Simulate a small delay
    await new Promise((r) => setTimeout(r, 300));

    const key = `${campaignId}:${contributor}`;

    // If already refunded, contribution is zeroed
    if (MOCK_REFUNDED.has(key)) return 0;

    // Auto-seed a mock contribution when the wallet matches the demo address
    if (!(key in MOCK_CONTRIBUTIONS)) {
      // Give the connected wallet a mock contribution on refund-eligible campaigns
      const campaign = MOCK_CAMPAIGNS.find((c) => c.id === campaignId);
      if (campaign) {
        const isEligible =
          campaign.isCancelled ||
          (Date.now() / 1000 > campaign.deadline &&
            campaign.amountRaised < campaign.fundingGoal);
        if (isEligible) {
          // Seed a random contribution between 50 – 500 XLM
          MOCK_CONTRIBUTIONS[key] = Math.floor(Math.random() * 451) + 50;
        }
      }
    }

    return MOCK_CONTRIBUTIONS[key] ?? 0;
  }

  // TODO(#14): Replace with real Soroban contract call
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}

/**
 * Claims a refund for a contributor on a failed/cancelled campaign.
 * Returns a mock transaction hash on success.
 */
export async function claimRefund(
  campaignId: number,
  contributor: string
): Promise<{ transactionHash: string; refundedAmount: number }> {
  if (USE_MOCKS) {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 1500));

    const key = `${campaignId}:${contributor}`;

    // Check if already refunded
    if (MOCK_REFUNDED.has(key)) {
      throw new Error('Already refunded');
    }

    const amount = MOCK_CONTRIBUTIONS[key] ?? 0;
    if (amount === 0) {
      throw new Error('No contribution found for this campaign.');
    }

    // Mark as refunded and zero the contribution
    MOCK_REFUNDED.add(key);
    MOCK_CONTRIBUTIONS[key] = 0;

    return {
      transactionHash: `mock_refund_tx_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      refundedAmount: amount,
    };
  }

  // TODO(#14): Replace with real Soroban contract call
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}

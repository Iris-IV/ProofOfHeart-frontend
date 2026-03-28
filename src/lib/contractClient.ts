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

// ---------------------------------------------------------------------------
// Mock voting state (mirrors what the contract tracks on-chain)
// ---------------------------------------------------------------------------

/** { campaignId -> { voter -> approve } } */
const MOCK_VOTES: Record<number, Record<string, boolean>> = {};

const MOCK_MIN_VOTES_QUORUM = 10;
const MOCK_APPROVAL_THRESHOLD_BPS = 6000; // 60%

const USE_MOCKS =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

// ---------------------------------------------------------------------------
// Voting helpers (mock)
// ---------------------------------------------------------------------------

function mockVotesFor(campaignId: number) {
  if (!MOCK_VOTES[campaignId]) MOCK_VOTES[campaignId] = {};
  return MOCK_VOTES[campaignId];
}

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
// Voting functions
// ---------------------------------------------------------------------------

/**
 * Casts a vote on a campaign.
 * Maps to contract: vote_on_campaign(campaign_id, voter, approve)
 */
export async function voteOnCampaign(
  campaignId: number,
  voter: string,
  approve: boolean
): Promise<void> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 800)); // simulate tx latency
    const votes = mockVotesFor(campaignId);
    if (voter in votes) throw new Error('You have already voted on this campaign.');
    votes[voter] = approve;
    // Reflect in mock campaign data
    const campaign = MOCK_CAMPAIGNS.find((c) => c.id === campaignId);
    if (campaign) {
      if (approve) campaign.upvotes += 1;
      else campaign.downvotes += 1;
      campaign.totalVotes += 1;
    }
    return;
  }

  // TODO(#14): Replace with real Soroban contract call, e.g.:
  // const client = new ProofOfHeartClient({ contractId: CONTRACT_ID, rpc: RPC_URL });
  // await client.vote_on_campaign({ campaign_id: campaignId, voter, approve });
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}

/**
 * Returns the number of approve votes for a campaign.
 * Maps to contract: get_approve_votes(campaign_id) -> u32
 */
export async function getApproveVotes(campaignId: number): Promise<number> {
  if (USE_MOCKS) {
    const votes = mockVotesFor(campaignId);
    return Object.values(votes).filter(Boolean).length;
  }

  // TODO(#14): const result = await client.get_approve_votes({ campaign_id: campaignId });
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}

/**
 * Returns the number of reject votes for a campaign.
 * Maps to contract: get_reject_votes(campaign_id) -> u32
 */
export async function getRejectVotes(campaignId: number): Promise<number> {
  if (USE_MOCKS) {
    const votes = mockVotesFor(campaignId);
    return Object.values(votes).filter((v) => !v).length;
  }

  // TODO(#14): const result = await client.get_reject_votes({ campaign_id: campaignId });
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}

/**
 * Checks whether a voter has already voted on a campaign.
 * Maps to contract: has_voted(campaign_id, voter) -> bool
 */
export async function hasVoted(campaignId: number, voter: string): Promise<boolean> {
  if (USE_MOCKS) {
    return voter in mockVotesFor(campaignId);
  }

  // TODO(#14): const result = await client.has_voted({ campaign_id: campaignId, voter });
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}

/**
 * Triggers on-chain verification once quorum + threshold are met.
 * Maps to contract: verify_campaign_with_votes(campaign_id)
 */
export async function verifyWithVotes(campaignId: number): Promise<void> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 800));
    const campaign = MOCK_CAMPAIGNS.find((c) => c.id === campaignId);
    if (campaign) campaign.status = 'approved';
    return;
  }

  // TODO(#14): await client.verify_campaign_with_votes({ campaign_id: campaignId });
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}

/**
 * Returns the minimum number of votes required for quorum.
 * Maps to contract: get_min_votes_quorum() -> u32
 */
export async function getMinVotesQuorum(): Promise<number> {
  if (USE_MOCKS) return MOCK_MIN_VOTES_QUORUM;

  // TODO(#14): const result = await client.get_min_votes_quorum();
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}

/**
 * Returns the approval threshold in basis points (e.g. 6000 = 60%).
 * Maps to contract: get_approval_threshold_bps() -> u32
 */
export async function getApprovalThresholdBps(): Promise<number> {
  if (USE_MOCKS) return MOCK_APPROVAL_THRESHOLD_BPS;

  // TODO(#14): const result = await client.get_approval_threshold_bps();
  throw new Error(
    'Live contract client is not yet wired up. Add NEXT_PUBLIC_USE_MOCKS=true to .env.local for development.'
  );
}

/**
 * @deprecated This mock service has been replaced by the real contract client.
 * Use the voting functions in `src/lib/contractClient.ts` instead:
 *   - voteOnCampaign(campaignId, voter, approve)
 *   - getApproveVotes(campaignId)
 *   - getRejectVotes(campaignId)
 *   - hasVoted(campaignId, voter)
 *   - verifyWithVotes(campaignId)
 *
 * This file is kept temporarily to avoid breaking any remaining references
 * and will be removed in a follow-up cleanup PR.
 */

// Mock Stellar voting service - replaced by contractClient.ts voting functions

export class StellarVotingService {
  // Mock storage for votes (in real implementation, this would be on-chain)
  private votes: Record<string, { voter: string; voteType: 'upvote' | 'downvote'; timestamp: Date }[]> = {};

  async castVote(
    causeId: string,
    voteType: 'upvote' | 'downvote',
    voterPublicKey: string
  ): Promise<string> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if user already voted
    if (this.hasUserVoted(causeId, voterPublicKey)) {
      throw new Error('User has already voted on this cause');
    }

    // Record the vote
    if (!this.votes[causeId]) {
      this.votes[causeId] = [];
    }

    this.votes[causeId].push({
      voter: voterPublicKey,
      voteType,
      timestamp: new Date(),
    });

    // Generate mock transaction hash
    const mockTransactionHash = `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return mockTransactionHash;
  }

  hasUserVoted(causeId: string, voterPublicKey: string): boolean {
    const causeVotes = this.votes[causeId];
    if (!causeVotes) return false;

    return causeVotes.some(vote => vote.voter === voterPublicKey);
  }

  async getVoteCounts(causeId: string): Promise<{ upvotes: number; downvotes: number }> {
    const causeVotes = this.votes[causeId];
    if (!causeVotes) return { upvotes: 0, downvotes: 0 };

    const upvotes = causeVotes.filter(vote => vote.voteType === 'upvote').length;
    const downvotes = causeVotes.filter(vote => vote.voteType === 'downvote').length;

    return { upvotes, downvotes };
  }

  // Get user's vote for a cause
  getUserVote(causeId: string, voterPublicKey: string): { voteType: 'upvote' | 'downvote'; timestamp: Date } | null {
    const causeVotes = this.votes[causeId];
    if (!causeVotes) return null;

    const userVote = causeVotes.find(vote => vote.voter === voterPublicKey);
    return userVote || null;
  }
}

export const stellarVotingService = new StellarVotingService();
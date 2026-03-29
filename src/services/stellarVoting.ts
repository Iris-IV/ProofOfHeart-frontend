// Mock Stellar voting service - in production, this would integrate with actual Stellar smart contracts
// For demonstration purposes, this simulates blockchain voting functionality

export class StellarVotingService {
  // Mock storage for votes (in real implementation, this would be on-chain)
  private votes: Record<string, { voter: string; voteType: 'upvote' | 'downvote'; timestamp: Date }[]> = {};

  async castVote(
    campaignId: string,
    voteType: 'upvote' | 'downvote',
    voterPublicKey: string
  ): Promise<string> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if user already voted
    if (this.hasUserVoted(campaignId, voterPublicKey)) {
      throw new Error('User has already voted on this campaign');
    }

    // Record the vote
    if (!this.votes[campaignId]) {
      this.votes[campaignId] = [];
    }

    this.votes[campaignId].push({
      voter: voterPublicKey,
      voteType,
      timestamp: new Date(),
    });

    // Generate mock transaction hash
    const mockTransactionHash = `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return mockTransactionHash;
  }

  hasUserVoted(campaignId: string, voterPublicKey: string): boolean {
    const campaignVotes = this.votes[campaignId];
    if (!campaignVotes) return false;

    return campaignVotes.some(vote => vote.voter === voterPublicKey);
  }

  async getVoteCounts(campaignId: string): Promise<{ upvotes: number; downvotes: number }> {
    const campaignVotes = this.votes[campaignId];
    if (!campaignVotes) return { upvotes: 0, downvotes: 0 };

    const upvotes = campaignVotes.filter(vote => vote.voteType === 'upvote').length;
    const downvotes = campaignVotes.filter(vote => vote.voteType === 'downvote').length;

    return { upvotes, downvotes };
  }

  // Get user's vote for a cause
  getUserVote(campaignId: string, voterPublicKey: string): { voteType: 'upvote' | 'downvote'; timestamp: Date } | null {
    const campaignVotes = this.votes[campaignId];
    if (!campaignVotes) return null;

    const userVote = campaignVotes.find(vote => vote.voter === voterPublicKey);
    return userVote || null;
  }
}

export const stellarVotingService = new StellarVotingService();
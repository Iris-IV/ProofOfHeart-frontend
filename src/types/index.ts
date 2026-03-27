export interface Cause {
  id: string;
  title: string;
  description: string;
  longDescription?: string;
  creator: string;
  createdAt: Date;
  upvotes: number;
  downvotes: number;
  totalVotes: number;
  status: 'pending' | 'approved' | 'rejected';
  category: string;
  targetAmount?: number;
  currentAmount?: number;
  imageUrl?: string;
  tags?: string[];
}

export interface Vote {
  causeId: string;
  voter: string;
  voteType: 'upvote' | 'downvote';
  timestamp: Date;
  transactionHash: string;
}

export interface VotingResult {
  causeId: string;
  upvotes: number;
  downvotes: number;
  totalVotes: number;
  approvalRate: number;
}
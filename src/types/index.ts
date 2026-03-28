/** Contract-aligned Campaign type — mirrors the on-chain Soroban struct. */
export interface Campaign {
  id: number;
  title: string;
  description: string;
  creator: string;       // Stellar address
  createdAt: number;     // Unix timestamp (seconds)
  upvotes: number;
  downvotes: number;
  totalVotes: number;
  status: 'pending' | 'approved' | 'rejected';
  category: string;
  targetAmount: number;  // in XLM
  currentAmount: number; // in XLM
  deadline: number;      // Unix timestamp (seconds) — campaign end date
  fundingGoal: number;   // funding goal in XLM (mirrors targetAmount on-chain)
  amountRaised: number;  // total amount raised in XLM
  isCancelled: boolean;  // true if the campaign was cancelled by creator/admin
}

/** Result returned after a successful refund claim. */
export interface RefundResult {
  campaignId: number;
  contributor: string;
  refundedAmount: number; // in XLM
  transactionHash: string;
}

/** @deprecated Use Campaign instead — will be removed once contract integration is complete. */
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
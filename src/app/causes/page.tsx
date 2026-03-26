'use client';

import { useState, useEffect } from 'react';
import WalletConnection from '../../components/WalletConnection';
import CauseCard from '../../components/CauseCard';
import { Cause, Vote } from '../../types';
import { stellarVotingService } from '../../services/stellarVoting';

// Mock data - in a real app, this would come from an API
const mockCauses: Cause[] = [
  {
    id: '1',
    title: 'Clean Water for Rural Communities',
    description: 'Providing clean water access to 500 families in rural areas affected by drought. This cause aims to install sustainable water filtration systems.',
    creator: 'GABC123456789012345678901234567890123456789012345678901234567890',
    createdAt: new Date('2024-01-15'),
    upvotes: 45,
    downvotes: 12,
    totalVotes: 57,
    status: 'approved',
    category: 'environment',
    targetAmount: 10000,
    currentAmount: 6500,
  },
  {
    id: '2',
    title: 'Education Technology for Underprivileged Children',
    description: 'Equipping schools in low-income areas with tablets and educational software to bridge the digital divide.',
    creator: 'GDEF123456789012345678901234567890123456789012345678901234567890',
    createdAt: new Date('2024-01-20'),
    upvotes: 23,
    downvotes: 8,
    totalVotes: 31,
    status: 'pending',
    category: 'education',
    targetAmount: 5000,
    currentAmount: 1200,
  },
  {
    id: '3',
    title: 'Medical Supplies for Remote Clinics',
    description: 'Delivering essential medical supplies and equipment to clinics in remote areas with limited healthcare access.',
    creator: 'GHIJ123456789012345678901234567890123456789012345678901234567890',
    createdAt: new Date('2024-01-25'),
    upvotes: 67,
    downvotes: 15,
    totalVotes: 82,
    status: 'approved',
    category: 'healthcare',
    targetAmount: 15000,
    currentAmount: 8900,
  },
];

export default function CausesPage() {
  const [causes, setCauses] = useState<Cause[]>(mockCauses);
  const [userWalletAddress, setUserWalletAddress] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, Vote>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load user votes when wallet is connected
    if (userWalletAddress) {
      loadUserVotes();
    }
  }, [userWalletAddress]);

  const loadUserVotes = async () => {
    if (!userWalletAddress) return;

    const votes: Record<string, Vote> = {};
    for (const cause of causes) {
      const userVote = stellarVotingService.getUserVote(cause.id, userWalletAddress);
      if (userVote) {
        votes[cause.id] = {
          causeId: cause.id,
          voter: userWalletAddress,
          voteType: userVote.voteType,
          timestamp: userVote.timestamp,
          transactionHash: 'mock-hash',
        };
      }
    }
    setUserVotes(votes);
  };

  const handleWalletConnected = (publicKey: string) => {
    setUserWalletAddress(publicKey);
  };

  const handleWalletDisconnected = () => {
    setUserWalletAddress(null);
    setUserVotes({});
  };

  const handleVote = async (causeId: string, voteType: 'upvote' | 'downvote') => {
    if (!userWalletAddress) {
      alert('Please connect your wallet first');
      return;
    }

    // Check if user already voted
    if (stellarVotingService.hasUserVoted(causeId, userWalletAddress)) {
      alert('You have already voted on this cause');
      return;
    }

    setIsLoading(true);
    try {
      // Cast vote on Stellar network
      const transactionHash = await stellarVotingService.castVote(causeId, voteType, userWalletAddress);

      // Update local state
      const newVote: Vote = {
        causeId,
        voter: userWalletAddress,
        voteType,
        timestamp: new Date(),
        transactionHash,
      };

      setUserVotes(prev => ({ ...prev, [causeId]: newVote }));

      // Update cause vote counts
      setCauses(prev => prev.map(cause => {
        if (cause.id === causeId) {
          return {
            ...cause,
            upvotes: voteType === 'upvote' ? cause.upvotes + 1 : cause.upvotes,
            downvotes: voteType === 'downvote' ? cause.downvotes + 1 : cause.downvotes,
            totalVotes: cause.totalVotes + 1,
          };
        }
        return cause;
      }));

      alert(`Vote cast successfully! Transaction: ${transactionHash}`);
    } catch (error) {
      console.error('Voting failed:', error);
      alert('Failed to cast vote. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
              Community Causes
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Vote on causes that matter to you. Your voice helps validate and fund meaningful initiatives.
            </p>
          </div>
          <WalletConnection
            onWalletConnected={handleWalletConnected}
            onWalletDisconnected={handleWalletDisconnected}
          />
        </div>

        {isLoading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-50"></div>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">Processing vote...</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {causes.map((cause) => (
            <CauseCard
              key={cause.id}
              cause={cause}
              userWalletAddress={userWalletAddress}
              onVote={handleVote}
              userVote={userVotes[cause.id]}
            />
          ))}
        </div>

        {causes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-600 dark:text-zinc-400">No causes available at the moment.</p>
          </div>
        )}
      </main>
    </div>
  );
}
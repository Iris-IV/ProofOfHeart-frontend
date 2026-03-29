"use client";

import { useWallet } from "@/components/WalletContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useMemo, useCallback } from "react";
import { getStellarBalance } from "@/lib/getStellarBalance";

export default function DashboardPage() {
  const { publicKey, isWalletConnected } = useWallet();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, [isWalletConnected]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-50"></div>
        <span className="ml-3 text-zinc-600 dark:text-zinc-400">Loading dashboard...</span>
      </div>
    );
  }

  if (!isWalletConnected || !publicKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-2xl font-semibold mb-4">Connect your wallet to view your dashboard</h2>
        <Link href="/" className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition">Go Home</Link>
      </div>
    );
  }

  const { campaigns, isLoading: isCampaignsLoading, error: campaignsError } = useCampaigns();
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const bal = await getStellarBalance(publicKey);
      setBalance(bal);
    } catch (err) {
      setBalanceError('Failed to fetch balance.');
    } finally {
      setBalanceLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) fetchBalance();
  }, [publicKey, fetchBalance]);

  // Mock voting history (replace with real data/service when available)
  const mockVotes = useMemo(() => [
    // Only show votes for the current user
    { causeId: 1, voter: publicKey, voteType: 'upvote', timestamp: new Date('2024-02-01'), transactionHash: 'tx1' },
    { causeId: 2, voter: publicKey, voteType: 'downvote', timestamp: new Date('2024-02-10'), transactionHash: 'tx2' },
  ], [publicKey]);

  const submittedCauses = campaigns.filter((c) => c.creator === publicKey);
  const votedCauseIds = mockVotes.map((v) => v.causeId);
  const votedCauses = campaigns.filter((c) => votedCauseIds.includes(c.id));

  // Mock funding/donation history (replace with real data/service when available)
  const mockFunding = useMemo(() => [
    { causeId: 3, amount: 100, timestamp: new Date('2024-02-15'), tx: 'fund1' },
    { causeId: 1, amount: 50, timestamp: new Date('2024-02-20'), tx: 'fund2' },
  ], [publicKey]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Your Dashboard</h1>
      <div className="grid gap-8">
        {/* Submitted Causes */}
        <section className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Submitted Causes</h2>
          {isCampaignsLoading ? (
            <p className="text-zinc-500">Loading your submitted causes…</p>
          ) : campaignsError ? (
            <p className="text-red-500">{campaignsError}</p>
          ) : submittedCauses.length === 0 ? (
            <p className="text-zinc-500">You have not submitted any causes yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {submittedCauses.map((cause) => (
                <li key={cause.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">{cause.title}</div>
                    <div className="text-sm text-zinc-500">Status: <span className="capitalize">{cause.status}</span></div>
                  </div>
                  <div className="mt-2 sm:mt-0 text-xs text-zinc-400">Created: {new Date(cause.createdAt * 1000).toLocaleDateString()}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
        {/* Voting History */}
        <section className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Voting History</h2>
          {mockVotes.length === 0 ? (
            <p className="text-zinc-500">You have not voted on any causes yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {mockVotes.map((vote) => {
                const cause = campaigns.find((c) => c.id === vote.causeId);
                return (
                  <li key={vote.transactionHash} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-50">{cause ? cause.title : `Cause #${vote.causeId}`}</div>
                      <div className="text-sm text-zinc-500">You voted <span className={vote.voteType === 'upvote' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{vote.voteType}</span></div>
                    </div>
                    <div className="mt-2 sm:mt-0 text-xs text-zinc-400">{vote.timestamp.toLocaleDateString()}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        {/* Funding History */}
        <section className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Funding/Donation History</h2>
          {mockFunding.length === 0 ? (
            <p className="text-zinc-500">You have not funded or donated to any causes yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {mockFunding.map((fund) => {
                const cause = campaigns.find((c) => c.id === fund.causeId);
                return (
                  <li key={fund.tx} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-50">{cause ? cause.title : `Cause #${fund.causeId}`}</div>
                      <div className="text-sm text-zinc-500">Amount: <span className="font-semibold">{fund.amount} XLM</span></div>
                    </div>
                    <div className="mt-2 sm:mt-0 text-xs text-zinc-400">{fund.timestamp.toLocaleDateString()}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        {/* Wallet Balance */}
        <section className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Wallet Balance</h2>
          {balanceLoading ? (
            <p className="text-zinc-500">Fetching balance…</p>
          ) : balanceError ? (
            <p className="text-red-500">{balanceError}</p>
          ) : balance !== null ? (
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{balance} XLM</div>
          ) : (
            <p className="text-zinc-500">Balance not available.</p>
          )}
        </section>
      </div>
    </div>
  );
}

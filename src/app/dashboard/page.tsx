"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletContext";
import { useCampaigns } from "@/hooks/useCampaigns";
import { getStellarBalance } from "@/lib/getStellarBalance";
import RevenueSharingPanel from "@/components/RevenueSharingPanel";
import { basisPointsToPercentage, stroopsToXlm } from "@/types";

export default function DashboardPage() {
  const { publicKey, isWalletConnected } = useWallet();
  const [loading, setLoading] = useState(true);
  const { campaigns } = useCampaigns();
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
    } catch {
      setBalanceError('Failed to fetch balance.');
    } finally {
      setBalanceLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    setLoading(false);
    if (publicKey) fetchBalance();
  }, [isWalletConnected, publicKey, fetchBalance]);

  // Mock voting history (replace with real data/service when available)
  const mockVotes = useMemo(() => [
    { causeId: 1, voter: publicKey, voteType: 'upvote', timestamp: new Date('2024-02-01'), transactionHash: 'tx1' },
    { causeId: 2, voter: publicKey, voteType: 'downvote', timestamp: new Date('2024-02-10'), transactionHash: 'tx2' },
  ], [publicKey]);
  // Mock funding/donation history (replace with real data/service when available)
  const mockFunding = useMemo(() => [
    { causeId: 3, amount: 100, timestamp: new Date('2024-02-15'), tx: 'fund1' },
    { causeId: 1, amount: 50, timestamp: new Date('2024-02-20'), tx: 'fund2' },
  ], []);
  const submittedCauses = useMemo(() => campaigns.filter((c) => c.creator === publicKey), [campaigns, publicKey]);

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

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8">Your Dashboard</h1>
      {/* Wallet Balance */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Wallet Balance</h2>
        {balanceLoading ? (
          <span className="text-zinc-500 dark:text-zinc-400">Loading balance...</span>
        ) : balanceError ? (
          <span className="text-red-500">{balanceError}</span>
        ) : (
          <span className="text-zinc-900 dark:text-zinc-50 font-mono">{balance} XLM</span>
        )}
      </section>

      {/* Submitted Causes */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Your Submitted Causes</h2>
        {submittedCauses.length === 0 ? (
          <span className="text-zinc-500 dark:text-zinc-400">You haven&apos;t submitted any causes yet.</span>
        ) : (
          <ul className="space-y-2">
            {submittedCauses.map((cause) => (
              <li key={cause.id} className="border rounded p-4 bg-zinc-50 dark:bg-zinc-900 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-medium">{cause.title}</div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">{cause.description}</div>
                    <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Raised {stroopsToXlm(cause.amount_raised).toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
                      {cause.has_revenue_sharing ? ` · ${basisPointsToPercentage(cause.revenue_share_percentage)} revenue sharing` : ''}
                    </div>
                  </div>
                  <Link
                    href={`/causes/${cause.id}`}
                    className="inline-flex items-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Open Campaign
                  </Link>
                </div>

                {cause.has_revenue_sharing && (
                  <RevenueSharingPanel
                    campaign={cause}
                    variant="dashboard"
                    showContributorControls={false}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Voting History */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Voting History</h2>
        {mockVotes.length === 0 ? (
          <span className="text-zinc-500 dark:text-zinc-400">No voting activity yet.</span>
        ) : (
          <ul className="space-y-2">
            {mockVotes.map((vote, idx) => {
              const cause = campaigns.find((c) => c.id === vote.causeId);
              return (
                <li key={idx} className="border rounded p-3 bg-zinc-50 dark:bg-zinc-900">
                  <div className="font-medium">{cause ? cause.title : `Cause #${vote.causeId}`}</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {vote.voteType === 'upvote' ? 'Upvoted' : 'Downvoted'} on {vote.timestamp.toLocaleDateString()} (tx: {vote.transactionHash})
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Funding/Donation History */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Funding/Donation History</h2>
        {mockFunding.length === 0 ? (
          <span className="text-zinc-500 dark:text-zinc-400">No funding/donation activity yet.</span>
        ) : (
          <ul className="space-y-2">
            {mockFunding.map((fund, idx) => {
              const cause = campaigns.find((c) => c.id === fund.causeId);
              return (
                <li key={idx} className="border rounded p-3 bg-zinc-50 dark:bg-zinc-900">
                  <div className="font-medium">{cause ? cause.title : `Cause #${fund.causeId}`}</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Donated {fund.amount} XLM on {fund.timestamp.toLocaleDateString()} (tx: {fund.tx})
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

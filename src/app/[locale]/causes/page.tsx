'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Campaign, Vote, CATEGORY_LABELS, CampaignStatus } from '@/types';
import { explorerTxUrl } from '@/utils/explorer';
import { SORT_OPTIONS } from '@/lib/mockCauses';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useWallet } from '@/components/WalletContext';
import { useToast } from '@/components/ToastProvider';
import { parseContractError } from '@/utils/contractErrors';
import { cancelCampaign, claimRefund, voteOnCampaign, hasVoted } from '@/lib/contractClient';
import CauseCard from '@/components/CauseCard';
import { CauseCardSkeleton } from '@/components/Skeleton';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Main content (needs Suspense because it reads searchParams)
// ---------------------------------------------------------------------------

function CausesContent() {
  const t = useTranslations('Causes');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rawSearch, setRawSearch] = useState(searchParams.get('q') ?? '');
  const [category, setCategory] = useState(searchParams.get('category') ?? 'all');
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all');
  const [sort, setSort] = useState(searchParams.get('sort') ?? 'newest');

  const debouncedSearch = useDebounce(rawSearch, 300);

  const STATUS_OPTIONS: ('all' | CampaignStatus)[] = ['all', 'active', 'cancelled', 'funded', 'failed'];

  const { campaigns: rawCampaigns, isLoading, error, refetch } = useCampaigns();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, Vote>>({});
  const [voteCounts, setVoteCounts] = useState<Record<number, { upvotes: number; downvotes: number; totalVotes: number }>>({});
  const [isVotingFor, setIsVotingFor] = useState<number | null>(null);
  const { publicKey: userWalletAddress } = useWallet();
  const { showError, showSuccess, showWarning } = useToast();

  // Mirror contract data into local state so optimistic updates work
  useEffect(() => {
    setCampaigns(rawCampaigns);
  }, [rawCampaigns]);

  // Sync URL query params whenever filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (category !== 'all') params.set('category', category);
    if (status !== 'all') params.set('status', status);
    if (sort !== 'newest') params.set('sort', sort);
    const qs = params.toString();
    router.replace(qs ? `/causes?${qs}` : '/causes', { scroll: false });
  }, [debouncedSearch, category, status, sort, router]);

  // Load user votes whenever wallet or campaigns change
  const loadUserVotes = useCallback(async () => {
    if (!userWalletAddress) return;
    const votes: Record<string, Vote> = {};
    await Promise.all(
      campaigns.map(async (campaign) => {
        try {
          const voted = await hasVoted(campaign.id, userWalletAddress);
          if (voted) {
            votes[campaign.id] = {
              causeId: String(campaign.id),
              voter: userWalletAddress,
              voteType: 'upvote',
              timestamp: new Date(),
              transactionHash: '',
            };
          }
        } catch {
          // ignore per-campaign errors
        }
      })
    );
    setUserVotes(votes);
  }, [userWalletAddress, campaigns]);

  useEffect(() => {
    if (userWalletAddress) loadUserVotes();
    else setUserVotes({});
  }, [userWalletAddress, loadUserVotes]);

  // -------------------------------------------------------------------------
  // Vote handler
  // -------------------------------------------------------------------------

  const handleVote = async (campaignId: number, voteType: 'upvote' | 'downvote') => {
    if (!userWalletAddress) {
      showWarning('Please connect your wallet first.');
      return;
    }
    if (userVotes[campaignId]) {
      showWarning('You have already voted on this cause.');
      return;
    }
    setIsVotingFor(campaignId);
    try {
      const transactionHash = await voteOnCampaign(campaignId, userWalletAddress, voteType === 'upvote');
      const newVote: Vote = {
        causeId: String(campaignId),
        voter: userWalletAddress,
        voteType,
        timestamp: new Date(),
        transactionHash,
      };
      setUserVotes((prev) => ({ ...prev, [campaignId]: newVote }));
      setVoteCounts((prev: Record<number, { upvotes: number; downvotes: number; totalVotes: number }>) => {
        const current = prev[campaignId] ?? { upvotes: 0, downvotes: 0, totalVotes: 0 };
        return {
          ...prev,
          [campaignId]: {
            upvotes: voteType === 'upvote' ? current.upvotes + 1 : current.upvotes,
            downvotes: voteType === 'downvote' ? current.downvotes + 1 : current.downvotes,
            totalVotes: current.totalVotes + 1,
          },
        };
      });
      showSuccess(
        `Your vote has been cast successfully. <a href="${explorerTxUrl(transactionHash)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">View on Explorer</a>`
      );
    } catch (error) {
      showError(parseContractError(error));
    } finally {
      setIsVotingFor(null);
    }
  };

  // -------------------------------------------------------------------------
  // Cancel handler
  // -------------------------------------------------------------------------

  const handleCancel = async (campaignId: number) => {
    if (!userWalletAddress) {
      showWarning('Please connect your wallet first.');
      return;
    }
    try {
      await cancelCampaign(campaignId);

      // Optimistic update: mark campaign as cancelled immediately so the UI
      // reflects the new state without waiting for a re-fetch.
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId ? { ...c, status: 'cancelled' as const } : c
        )
      );

      showSuccess('Campaign cancelled. Contributors can now claim full refunds.');
    } catch (error) {
      showError(parseContractError(error));
    }
  };

  // -------------------------------------------------------------------------
  // Claim refund handler
  // -------------------------------------------------------------------------

  const handleClaimRefund = async (campaignId: number) => {
    if (!userWalletAddress) {
      showWarning('Please connect your wallet first.');
      return;
    }
    try {
      await claimRefund(campaignId, userWalletAddress);
      showSuccess('Refund claimed successfully. Funds will appear in your wallet shortly.');
    } catch (error) {
      showError(parseContractError(error));
    }
  };

  // -------------------------------------------------------------------------
  // Filtering + sorting
  // -------------------------------------------------------------------------

  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns];

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          (CATEGORY_LABELS[c.category] ?? '').toLowerCase().includes(q)
      );
    }

    if (category !== 'all') result = result.filter((c) => String(c.category) === category);
    if (status !== 'all') result = result.filter((c) => c.status === status);

    switch (sort) {
      case 'oldest':
        result.sort((a, b) => a.deadline - b.deadline);
        break;
      case 'most_voted': {
        result.sort((a, b) => {
          const aTotal = voteCounts[b.id]?.totalVotes ?? 0;
          const bTotal = voteCounts[a.id]?.totalVotes ?? 0;
          return aTotal - bTotal;
        });
        break;
      }
      case 'most_funded':
        result.sort((a, b) => Number(b.amount_raised - a.amount_raised));
        break;
      case 'approval_rate': {
        result.sort((a, b) => {
          const aVotes = voteCounts[a.id];
          const bVotes = voteCounts[b.id];
          const aRate = aVotes && aVotes.totalVotes > 0 ? aVotes.upvotes / aVotes.totalVotes : 0;
          const bRate = bVotes && bVotes.totalVotes > 0 ? bVotes.upvotes / bVotes.totalVotes : 0;
          return bRate - aRate;
        });
        break;
      }
      default: // newest
        result.sort((a, b) => b.deadline - a.deadline);
    }

    return result;
  }, [campaigns, debouncedSearch, category, status, sort, voteCounts]);

  const hasActiveFilters =
    debouncedSearch || category !== 'all' || status !== 'all' || sort !== 'newest';

  const clearFilters = () => {
    setRawSearch('');
    setCategory('all');
    setStatus('all');
    setSort('newest');
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
      <main className="container mx-auto px-4 py-8">
        {/* Page heading */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
            {t('pageTitle')}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {t('pageSubtitle')}
          </p>
        </div>

        {/* Search + filters bar */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 mb-6 space-y-3">
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {rawSearch && (
              <button
                onClick={() => setRawSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                {t('labelCategory')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t('allCategories')}</option>
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {t('labelStatus')}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === 'all' ? t('allStatuses') : s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {t('labelSortBy')}
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-auto"
              >
                {t('clearFilters')}
              </button>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 mb-6 text-center">
            <p className="text-red-700 dark:text-red-400 font-medium mb-3">{error}</p>
            <button
              onClick={refetch}
              className="px-5 py-2 bg-red-600 text-white rounded-full text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <CauseCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && (
          <>
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 flex items-center gap-3">
              <span>
                {t(filteredCampaigns.length === 1 ? 'causesFound_one' : 'causesFound_other', { count: filteredCampaigns.length })}
                {debouncedSearch && <span>{t('causesFoundFor', { query: debouncedSearch })}</span>}
              </span>
              {isVotingFor !== null && (
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block motion-safe:animate-spin rounded-full h-3 w-3 border-b border-zinc-500" />
                  {t('processingVote')}
                </span>
              )}
            </div>

            {filteredCampaigns.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCampaigns.map((campaign) => (
                  <CauseCard
                    key={campaign.id}
                    campaign={campaign}
                    userWalletAddress={userWalletAddress}
                    onVote={handleVote}
                    onCancel={handleCancel}
                    onClaimRefund={handleClaimRefund}
                    userVote={userVotes[campaign.id]}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">🔍</div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                  {campaigns.length === 0 ? t('noCausesYet') : t('noCausesFound')}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                  {campaigns.length === 0 ? t('beFirstToSubmit') : t('tryDifferentKeyword')}
                </p>
                {campaigns.length > 0 && (
                  <button
                    onClick={clearFilters}
                    className="px-6 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    {t('clearAllFilters')}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function CausesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="motion-safe:animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      }
    >
      <CausesContent />
    </Suspense>
  );
}
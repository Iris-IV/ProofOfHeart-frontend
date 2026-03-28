'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCampaigns } from '../../hooks/useCampaigns';
import { Campaign, Category } from '../../types';
import { categoryLabel, getCategoryIcon } from '../../utils/category';

const STATUS_STYLES: Record<Campaign['status'], string> = {
  approved: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  rejected: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
};

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function CampaignRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-2/3" />
        <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2" />
      </div>
      <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-700 rounded-full shrink-0" />
    </div>
  );
}

export default function ExplorePage() {
  const { campaigns, isLoading, error, refetch } = useCampaigns();
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');

  const categories = useMemo(() => {
    const seen = new Set(campaigns.map((c) => c.category));
    return ['all' as const, ...Array.from(seen).sort((a, b) => a - b)];
  }, [campaigns]);

  const filtered = useMemo(
    () =>
      activeCategory === 'all'
        ? campaigns
        : campaigns.filter((c) => c.category === activeCategory),
    [campaigns, activeCategory]
  );

  // Sort by approval rate descending for the explore view
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const aRate = a.totalVotes > 0 ? a.upvotes / a.totalVotes : 0;
        const bRate = b.totalVotes > 0 ? b.upvotes / b.totalVotes : 0;
        return bRate - aRate;
      }),
    [filtered]
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Explore
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
        Browse causes, see community validation, and support what matters.
      </p>

      {/* Category pills */}
      {!isLoading && !error && categories.length > 1 && (
        <div className="flex flex-wrap gap-2 mt-6">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {cat === 'all' ? 'All' : `${getCategoryIcon(cat as Category)} ${categoryLabel(cat as Category)}`}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-8 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center">
          <p className="text-red-700 dark:text-red-400 font-medium mb-3">{error}</p>
          <button
            onClick={refetch}
            className="px-5 py-2 bg-red-600 text-white rounded-full text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CampaignRowSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && sorted.length === 0 && (
        <div className="mt-16 text-center">
          <div className="text-5xl mb-4">🌐</div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
            {campaigns.length === 0 ? 'No causes yet' : 'No causes in this category'}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            {campaigns.length === 0
              ? 'Check back soon — the community is just getting started.'
              : 'Try selecting a different category above.'}
          </p>
        </div>
      )}

      {/* Campaign list */}
      {!isLoading && !error && sorted.length > 0 && (
        <div className="mt-6 space-y-3">
          {sorted.map((campaign, idx) => {
            const approvalRate =
              campaign.totalVotes > 0
                ? Math.round((campaign.upvotes / campaign.totalVotes) * 100)
                : 0;
            return (
              <Link
                key={campaign.id}
                href={`/causes/${campaign.id}`}
                className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all group"
              >
                {/* Rank */}
                <span className="w-6 text-center text-sm font-bold text-zinc-400 dark:text-zinc-500 shrink-0">
                  {idx + 1}
                </span>

                {/* Icon */}
                <span className="text-2xl shrink-0">
                  {getCategoryIcon(campaign.category)}
                </span>

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                    {campaign.title}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    By {formatAddress(campaign.creator)} · {campaign.totalVotes} votes · {approvalRate}% approval
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[campaign.status]}`}
                >
                  {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

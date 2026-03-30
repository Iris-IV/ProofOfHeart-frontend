'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCampaigns } from '@/hooks/useCampaigns';
import { Category, CATEGORY_LABELS, stroopsToXlm } from '@/types';
import CampaignStatusBadge from '@/components/CampaignStatusBadge';
import FundingProgressBar from '@/components/FundingProgressBar';
import { CampaignRowSkeleton } from '@/components/Skeleton';
import CampaignStatusBadge from '../../components/CampaignStatusBadge';
import FundingProgressBar from '../../components/FundingProgressBar';
import { CampaignRowSkeleton } from '@/components/Skeleton';

const CATEGORY_ICONS: Record<Category, string> = {
  [Category.Learner]: '🎓',
  [Category.EducationalStartup]: '🚀',
  [Category.Educator]: '👩‍🏫',
  [Category.Publisher]: '📚',
};

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ExplorePage() {
  const { campaigns, isLoading, error, refetch } = useCampaigns();
  const [activeCategory, setActiveCategory] = useState<'all' | Category>('all');

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

  // Sort by funding progress descending for the explore view
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const aProgress = a.funding_goal > BigInt(0) ? Number(a.amount_raised * BigInt(10000) / a.funding_goal) : 0;
        const bProgress = b.funding_goal > BigInt(0) ? Number(b.amount_raised * BigInt(10000) / b.funding_goal) : 0;
        return bProgress - aProgress;
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
              key={String(cat)}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
            >
              {cat === 'all' ? 'All' : `${CATEGORY_ICONS[cat] ?? ''} ${CATEGORY_LABELS[cat]}`}
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
          {sorted.map((campaign, idx) => (
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
                {CATEGORY_ICONS[campaign.category] ?? '💡'}
              </span>

              {/* Title + meta */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                  {campaign.title}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  By {formatAddress(campaign.creator)} · {stroopsToXlm(campaign.amount_raised).toFixed(1)} / {stroopsToXlm(campaign.funding_goal).toFixed(1)} XLM
                </p>
                <div className="mt-1.5">
                  <FundingProgressBar amountRaised={campaign.amount_raised} fundingGoal={campaign.funding_goal} />
                </div>
              </div>

              {/* Status badge */}
              <div className="shrink-0">
                <CampaignStatusBadge campaign={campaign} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

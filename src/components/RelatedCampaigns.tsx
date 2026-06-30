"use client";

import { useCampaigns } from "@/hooks/useCampaigns";
import CauseCard from "./CauseCard";
import { CauseCardSkeleton } from "./Skeleton";

interface RelatedCampaignsProps {
  currentCampaignId: number;
  category: number;
  limit?: number;
}

export default function RelatedCampaigns({
  currentCampaignId,
  category,
  limit = 4,
}: RelatedCampaignsProps) {
  const { campaigns, isLoading, error } = useCampaigns();

  if (isLoading) {
    return (
      <section className="mt-12 sm:mt-16 pt-12 border-t border-zinc-200 dark:border-zinc-800">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-8">Similar Causes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {Array.from({ length: limit }).map((_, i) => (
            <CauseCardSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  if (error || !campaigns) {
    return null;
  }

  const relatedCampaigns = campaigns.filter((c) => {
    // Must be same category
    if (c.category !== category) return false;
    // Exclude current
    if (c.id === currentCampaignId) return false;
    // Exclude cancelled
    if (c.is_cancelled) return false;
    // Optionally exclude failed/expired? Acceptance criteria just says "cancelled ones"
    // but generally active is better. Let's just exclude cancelled to match AC.
    return true;
  });

  if (relatedCampaigns.length === 0) {
    return null;
  }

  // Shuffle or just take the first N? Let's take the first N (newest first based on how they are ordered, or just slice)
  const displayCampaigns = relatedCampaigns.slice(0, limit);

  return (
    <section className="mt-12 sm:mt-16 pt-12 border-t border-zinc-200 dark:border-zinc-800 motion-safe:animate-in fade-in slide-in-from-bottom-8 duration-700">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-8">Similar Causes</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {displayCampaigns.map((campaign) => (
          <CauseCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    </section>
  );
}

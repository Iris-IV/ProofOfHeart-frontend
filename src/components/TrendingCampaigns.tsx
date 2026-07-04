"use client";

import { useTrendingCampaigns } from "@/hooks/useTrendingCampaigns";
import CauseCard from "./CauseCard";
import { CauseCardSkeleton } from "./Skeleton";
import { useTranslations } from "next-intl";

export default function TrendingCampaigns() {
  const { trendingCampaigns, isLoading, error } = useTrendingCampaigns(4);
  const t = useTranslations("Home");

  if (isLoading) {
    return (
      <section className="mt-16 sm:mt-24 mb-16">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-3xl font-black text-red-500">🔥</span>
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Trending Causes</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <CauseCardSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  if (error || trendingCampaigns.length === 0) {
    return null;
  }

  return (
    <section className="mt-16 sm:mt-24 mb-16 motion-safe:animate-in fade-in slide-in-from-bottom-10 duration-1000">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl font-black text-red-500">🔥</span>
        <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Trending Causes</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {trendingCampaigns.map(({ campaign }) => (
          <CauseCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    </section>
  );
}

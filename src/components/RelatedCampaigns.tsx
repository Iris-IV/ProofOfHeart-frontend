"use client";

import { useCampaigns } from "@/hooks/useCampaigns";
import { Category, CATEGORY_LABELS } from "@/types";
import CauseCard from "./CauseCard";
import { CauseCardSkeleton } from "./Skeleton";

interface RelatedCampaignsProps {
  currentCampaignId: number;
  category: Category | string;
  userWalletAddress: string | null;
  onVote: (campaignId: number, voteType: "upvote" | "downvote") => Promise<void>;
  onCancel: (campaignId: number) => Promise<void>;
  onClaimRefund: (campaignId: number) => Promise<void>;
  limit?: number;
}

export default function RelatedCampaigns({
  currentCampaignId,
  category,
  userWalletAddress,
  onVote,
  onCancel,
  onClaimRefund,
  limit = 3,
}: RelatedCampaignsProps) {
  const { campaigns, isLoading } = useCampaigns();

  if (isLoading) {
    return (
      <section
        aria-labelledby="related-causes-heading"
        className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-700"
      >
        <h2
          id="related-causes-heading"
          className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-6"
        >
          Related Causes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: limit }).map((_, index) => (
            <CauseCardSkeleton key={index} />
          ))}
        </div>
      </section>
    );
  }

  const related = campaigns
    .filter(
      (c) =>
        c.id !== currentCampaignId &&
        (c.category === category || String(c.category) === String(category)) &&
        c.status !== "cancelled" &&
        !c.is_cancelled,
    )
    .slice(0, limit);

  if (related.length === 0) {
    return null;
  }

  const categoryLabel =
    typeof category === "number"
      ? (CATEGORY_LABELS[category as Category] ?? String(category))
      : (CATEGORY_LABELS[category as unknown as Category] ?? String(category));

  return (
    <section
      aria-labelledby="related-causes-heading"
      className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-700"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            id="related-causes-heading"
            className="text-xl font-bold text-zinc-900 dark:text-zinc-50"
          >
            Related Causes
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Explore more campaigns in{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{categoryLabel}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {related.map((campaign) => (
          <CauseCard
            key={campaign.id}
            campaign={campaign}
            userWalletAddress={userWalletAddress}
            onVote={onVote}
            onCancel={onCancel}
            onClaimRefund={onClaimRefund}
          />
        ))}
      </div>
    </section>
  );
}

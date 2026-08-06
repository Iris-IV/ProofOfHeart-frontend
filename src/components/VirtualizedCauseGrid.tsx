"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import CauseCard from "@/components/CauseCard";
import { Campaign, Vote } from "@/types";

interface VirtualizedCauseGridProps {
  campaigns: Campaign[];
  userWalletAddress: string | null;
  onVote: (campaignId: number, voteType: "upvote" | "downvote") => Promise<void>;
  onCancel: (campaignId: number) => Promise<void>;
  onClaimRefund: (campaignId: number) => Promise<void>;
  onTagClick: (tag: string) => void;
  userVotes: Record<string, Vote>;
  voteCounts: Record<number, { upvotes: number; downvotes: number; totalVotes: number }>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

/** Matches the grid's `md:grid-cols-2 lg:grid-cols-3` breakpoints so rows stay full. */
function useResponsiveColumnCount(): number {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const compute = () => {
      const width = window.innerWidth;
      if (width >= 1024) return 3;
      if (width >= 768) return 2;
      return 1;
    };
    setColumns(compute());

    const onResize = () => setColumns(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return columns;
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

const ESTIMATED_ROW_HEIGHT = 420;
/** Start fetching the next page this many rows before the end, so scrolling stays smooth. */
const PREFETCH_ROW_THRESHOLD = 2;

/**
 * Renders the campaign grid with row-based window virtualization
 * (`@tanstack/react-virtual`) instead of one DOM node per card. With 100+
 * campaigns, mounting every `CauseCard` up front was the main render/scroll
 * cost (issue #593) — only the rows near the viewport are ever mounted here,
 * and the rest is represented purely as scroll height.
 *
 * Pairs with `useInfiniteCampaigns`: scrolling near the bottom of what's
 * currently loaded fetches the next cursor-paginated page automatically: a
 * manual "Load more" button covers users who don't scroll (keyboard/AT).
 */
export default function VirtualizedCauseGrid({
  campaigns,
  userWalletAddress,
  onVote,
  onCancel,
  onClaimRefund,
  onTagClick,
  userVotes,
  voteCounts,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: VirtualizedCauseGridProps) {
  const columns = useResponsiveColumnCount();
  const rows = chunk(campaigns, columns);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    setScrollMargin(containerRef.current?.offsetTop ?? 0);
  }, []);

  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 3,
    scrollMargin,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || virtualRows.length === 0) return;
    const lastVirtualRow = virtualRows[virtualRows.length - 1];
    if (lastVirtualRow.index >= rows.length - PREFETCH_ROW_THRESHOLD) {
      onLoadMore();
    }
  }, [virtualRows, rows.length, hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <div>
      <div
        ref={containerRef}
        style={{ position: "relative", height: rowVirtualizer.getTotalSize() }}
      >
        {virtualRows.map((virtualRow) => (
          <div
            key={virtualRow.key}
            ref={rowVirtualizer.measureElement}
            data-index={virtualRow.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
              {rows[virtualRow.index].map((campaign) => (
                <CauseCard
                  key={campaign.id}
                  campaign={campaign}
                  userWalletAddress={userWalletAddress}
                  onVote={onVote}
                  onCancel={onCancel}
                  onClaimRefund={onClaimRefund}
                  onTagClick={onTagClick}
                  userVote={userVotes[campaign.id]}
                  upvotes={voteCounts[campaign.id]?.upvotes ?? 0}
                  downvotes={voteCounts[campaign.id]?.downvotes ?? 0}
                  totalVotes={voteCounts[campaign.id]?.totalVotes ?? 0}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {hasNextPage && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="px-6 py-2.5 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

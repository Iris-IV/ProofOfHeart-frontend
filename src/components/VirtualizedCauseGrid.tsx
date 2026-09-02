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
/**
 * Start fetching the next page when the user is this many rows from the end
 * of currently-loaded data — keeps the feed smooth without loading too far ahead.
 * Must be strictly less than the initial viewport row count to avoid an
 * immediate cascade on first render (issue #1150).
 */
const PREFETCH_ROW_THRESHOLD = 2;
/**
 * Minimum number of rows that must be loaded before the scroll-triggered
 * prefetch activates. Below this value the virtualizer has not received any
 * real scroll input yet, so triggering early would cause a cascade that loads
 * all pages upfront (root cause of issue #1150).
 * At ESTIMATED_ROW_HEIGHT=420px a 900px viewport shows ~2 rows, so requiring
 * at least 4 rows means the user must have received at least one full viewport
 * and scrolled meaningfully before the next page loads automatically.
 */
const MIN_ROWS_BEFORE_PREFETCH = 4;

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
    // Guard: don't auto-fetch until enough rows are loaded (issue #1150).
    // On first render the virtualizer shows all "estimated" rows even though
    // the user hasn't scrolled, so lastVirtualRow.index is trivially near
    // rows.length, which would cascade-load every page upfront.
    if (rows.length < MIN_ROWS_BEFORE_PREFETCH) return;
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
                  priority={virtualRow.index === 0}
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

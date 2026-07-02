"use client";

import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useCausesFilters } from "@/hooks/useCausesFilters";
import CauseCard from "@/components/CauseCard";
import CauseCardSkeleton from "@/components/CauseCardSkeleton";
import { CauseCardPlaceholder } from "@/components/CauseCardPlaceholder";
import FilterDropdown from "@/components/FilterDropdown";
import { PAGINATION_LIMIT } from "@/lib/pagination";
import { CAMPAIGNS_CHUNK_SIZE } from "@/lib/causesList";
import { Campaign } from "@/types";

interface CausesClientProps {
  initialLocale?: string;
}

interface CampaignVirtualGridProps {
  campaigns: Campaign[];
  isLoading: boolean;
  columns: number;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
}

function CampaignVirtualGrid({
  campaigns,
  isLoading,
  columns,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
}: CampaignVirtualGridProps) {
  // Group campaigns into rows based on column count
  const rows = useMemo(() => {
    const result = [];
    for (let i = 0; i < campaigns.length; i += columns) {
      result.push(campaigns.slice(i, i + columns));
    }
    return result;
  }, [campaigns, columns]);

  // Use virtualizer for efficient rendering of rows
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    gap: 24,
    overscan: 10,
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? undefined
        : (element) => element?.getBoundingClientRect().height,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0)
      : 0;

  // Load more when scrolling near the end
  const lastVisibleRow = virtualRows[virtualRows.length - 1];
  const isNearEnd =
    lastVisibleRow && lastVisibleRow.index >= rows.length - 3;
  if (isNearEnd && hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }

  const gridColsClass = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
  }[columns] || "grid-cols-1";

  return (
    <div>
      <div
        style={{
          paddingTop,
          paddingBottom,
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: "24px",
        }}
      >
        {virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div key={virtualRow.key} data-index={virtualRow.index}>
              {row.map((campaign) => (
                <CauseCard key={campaign.id} cause={campaign} />
              ))}
            </div>
          );
        })}
      </div>
      {isFetchingNextPage && (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
        </div>
      )}
    </div>
  );
}

function useColumns(): number {
  // Responsive column count based on viewport width
  // 1 column on mobile (<768px)
  // 2 columns on tablet (768px-1024px)
  // 3 columns on desktop (≥1024px)

  // Note: This is a simplified version that works with SSR
  // In a real app, you'd use a hook like useMediaQuery or window.matchMedia
  // For now, we assume 3 columns as default
  if (typeof window === "undefined") return 3;

  const width = window.innerWidth;
  if (width < 768) return 1;
  if (width < 1024) return 2;
  return 3;
}

export default function CausesClient({
  initialLocale = "en",
}: CausesClientProps) {
  const {
    campaigns,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error: campaignsError,
  } = useCampaigns();

  const columns = useColumns();

  const {
    filteredCampaigns,
    filters,
    setFilters,
    sortCampaigns,
    searchCampaigns,
    appliedFilters,
  } = useCausesFilters(campaigns);

  const isFiltering =
    !!filters.search ||
    filters.category !== "all" ||
    filters.status !== "all" ||
    filters.sortBy !== "newest";

  return (
    <div className="flex w-full flex-col gap-6 bg-gradient-to-b from-white via-white to-gray-50 px-4 pb-12 pt-2 sm:px-6 lg:px-8">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Causes</h1>
          <p className="mt-1 text-sm text-gray-600">
            {filteredCampaigns.length === 0
              ? "No causes found"
              : `${filteredCampaigns.length} cause${filteredCampaigns.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href={`/${initialLocale}/causes/new`}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5" />
          Create Cause
        </Link>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search causes..."
            value={filters.search}
            onChange={(e) => searchCampaigns(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <FilterDropdown
            label="Category"
            value={filters.category}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, category: value }))
            }
            options={[
              { value: "all", label: "All Categories" },
              { value: "education", label: "Education" },
              { value: "healthcare", label: "Healthcare" },
              { value: "environment", label: "Environment" },
            ]}
          />
          <FilterDropdown
            label="Status"
            value={filters.status}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, status: value }))
            }
            options={[
              { value: "all", label: "All Status" },
              { value: "active", label: "Active" },
              { value: "completed", label: "Completed" },
            ]}
          />
          <FilterDropdown
            label="Sort"
            value={filters.sortBy}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, sortBy: value }))
            }
            options={[
              { value: "newest", label: "Newest" },
              { value: "oldest", label: "Oldest" },
              { value: "funded", label: "Most Funded" },
            ]}
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CauseCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredCampaigns.length === 0 && !campaignsError && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center">
          <p className="text-gray-600">No causes found. Try adjusting filters.</p>
        </div>
      )}

      {/* Error state */}
      {campaignsError && (
        <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            Error loading causes: {campaignsError}
          </p>
        </div>
      )}

      {/* Grid with virtual scrolling */}
      {!isLoading && filteredCampaigns.length > 0 && (
        <CampaignVirtualGrid
          campaigns={filteredCampaigns}
          isLoading={isLoading}
          columns={columns}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          fetchNextPage={fetchNextPage}
        />
      )}
    </div>
  );
}

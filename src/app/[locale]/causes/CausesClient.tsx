"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import CauseCard from "@/components/CauseCard";
import { CauseCardSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/ToastProvider";
import { useWallet } from "@/components/WalletContext";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useRouter } from "@/i18n/routing";
import {
  cancelCampaign,
  claimRefund,
  voteOnCampaign,
  hasVoted,
  getApproveVotes,
  getRejectVotes,
} from "@/lib/contractClient";
import { CAMPAIGNS_CHUNK_SIZE } from "@/lib/causesList";
import { SORT_OPTIONS } from "@/lib/mockCauses";
import { Campaign, Vote, CATEGORY_LABELS, CampaignStatus, Category } from "@/types";
import { getAsyncActionErrorMessage, withActionTimeout } from "@/utils/asyncAction";
import { parseContractError } from "@/utils/contractErrors";
import { explorerTxUrl } from "@/utils/explorer";

const CATEGORY_ICONS: Record<Category, string> = {
  [Category.Learner]: "🎓",
  [Category.EducationalStartup]: "🚀",
  [Category.Educator]: "👩‍🏫",
  [Category.Publisher]: "📚",
};

const CATEGORY_VALUES = Object.values(Category).filter(
  (value): value is Category => typeof value === "number",
);

type CategoryFilter = "all" | Category;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function useColumns(): number {
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth < 768) {
        setColumns(1); // Mobile: 1 column
      } else if (window.innerWidth < 1024) {
        setColumns(2); // Tablet: 2 columns (md breakpoint)
      } else {
        setColumns(3); // Desktop: 3 columns (lg breakpoint)
      }
    };

    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  return columns;
}

// Levenshtein distance for fuzzy matching — allows 1 typo per 4 chars of word length
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatch(text: string, query: string): boolean {
  if (text.includes(query)) return true;
  const words = text.split(/\s+/);
  const queryWords = query.split(/\s+/);
  return queryWords.every((qw) =>
    words.some((w) => {
      const maxDist = Math.floor(w.length / 4);
      return levenshtein(w, qw) <= maxDist;
    }),
  );
}

// ---------------------------------------------------------------------------
// Main content (needs Suspense because it reads searchParams)
// ---------------------------------------------------------------------------

function CausesContent() {
  const t = useTranslations("Causes");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rawSearch, setRawSearch] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "all");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "newest");
  const [tag, setTag] = useState(searchParams.get("tag") ?? "");

  const debouncedSearch = useDebounce(rawSearch, 300);

  const STATUS_OPTIONS: ("all" | CampaignStatus)[] = [
    "all",
    "active",
    "cancelled",
    "funded",
    "failed",
  ];

  const {
    campaigns: rawCampaigns,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    isAllLoaded,
    error,
    refetch,
  } = useCampaigns();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, Vote>>({});
  const [voteCounts, setVoteCounts] = useState<
    Record<number, { upvotes: number; downvotes: number; totalVotes: number }>
  >({});
  const [isVotingFor, setIsVotingFor] = useState<number | null>(null);
  const { publicKey: userWalletAddress } = useWallet();
  const { showError, showSuccess, showWarning } = useToast();
  const columns = useColumns();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    if (scrollRef.current) {
      setScrollMargin(scrollRef.current.offsetTop);
    }
  }, []);

  // Mirror contract data into local state so optimistic updates work
  useEffect(() => {
    setCampaigns(rawCampaigns);
  }, [rawCampaigns]);

  // Sync URL query params whenever filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (category !== "all") params.set("category", category);
    if (status !== "all") params.set("status", status);
    if (sort !== "newest") params.set("sort", sort);
    if (tag) params.set("tag", tag);
    const qs = params.toString();
    router.replace(qs ? `/causes?${qs}` : "/causes", { scroll: false });
  }, [debouncedSearch, category, status, sort, tag, router]);

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
              voteType: "upvote",
              timestamp: new Date(),
              transactionHash: "",
            };
          }
        } catch {
          // ignore per-campaign errors
        }
      }),
    );
    setUserVotes(votes);
  }, [userWalletAddress, campaigns]);

  const loadVoteCounts = useCallback(async () => {
    const counts: Record<number, { upvotes: number; downvotes: number; totalVotes: number }> = {};
    await Promise.all(
      campaigns.map(async (campaign) => {
        try {
          const [approves, rejects] = await Promise.all([
            getApproveVotes(campaign.id),
            getRejectVotes(campaign.id),
          ]);
          counts[campaign.id] = {
            upvotes: approves,
            downvotes: rejects,
            totalVotes: approves + rejects,
          };
        } catch {
          counts[campaign.id] = { upvotes: 0, downvotes: 0, totalVotes: 0 };
        }
      }),
    );
    setVoteCounts(counts);
  }, [campaigns]);

  useEffect(() => {
    if (userWalletAddress) loadUserVotes();
    else setUserVotes({});
  }, [userWalletAddress, loadUserVotes]);

  useEffect(() => {
    if (campaigns.length > 0) {
      loadVoteCounts();
      return;
    }
    setVoteCounts({});
  }, [campaigns, loadVoteCounts]);

  // Auto-fetch remaining pages in background so filter/sort work on full set.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // -------------------------------------------------------------------------
  // Vote handler
  // -------------------------------------------------------------------------

  const handleVote = useCallback(
    async (campaignId: number, voteType: "upvote" | "downvote") => {
      if (!userWalletAddress) {
        showWarning("Please connect your wallet first.");
        return;
      }
      if (userVotes[campaignId]) {
        showWarning("You have already voted on this cause.");
        return;
      }
      setIsVotingFor(campaignId);
      try {
        const transactionHash = await withActionTimeout(
          voteOnCampaign(campaignId, userWalletAddress, voteType === "upvote"),
        );
        const newVote: Vote = {
          causeId: String(campaignId),
          voter: userWalletAddress,
          voteType,
          timestamp: new Date(),
          transactionHash,
        };
        setUserVotes((prev) => ({ ...prev, [campaignId]: newVote }));
        setVoteCounts(
          (prev: Record<number, { upvotes: number; downvotes: number; totalVotes: number }>) => {
            const current = prev[campaignId] ?? { upvotes: 0, downvotes: 0, totalVotes: 0 };
            return {
              ...prev,
              [campaignId]: {
                upvotes: voteType === "upvote" ? current.upvotes + 1 : current.upvotes,
                downvotes: voteType === "downvote" ? current.downvotes + 1 : current.downvotes,
                totalVotes: current.totalVotes + 1,
              },
            };
          },
        );
        showSuccess(
          `Your vote has been cast successfully. <a href="${explorerTxUrl(transactionHash)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">View on Explorer</a>`,
        );
      } catch (error) {
        showError(getAsyncActionErrorMessage(error, parseContractError));
      } finally {
        setIsVotingFor(null);
      }
    },
    [userWalletAddress, userVotes, showWarning, showSuccess, showError],
  );

  // -------------------------------------------------------------------------
  // Cancel handler
  // -------------------------------------------------------------------------

  const handleCancel = useCallback(
    async (campaignId: number) => {
      if (!userWalletAddress) {
        showWarning("Please connect your wallet first.");
        return;
      }
      try {
        await withActionTimeout(cancelCampaign(campaignId));

        // Optimistic update: mark campaign as cancelled immediately so the UI
        // reflects the new state without waiting for a re-fetch.
        setCampaigns((prev) =>
          prev.map((c) => (c.id === campaignId ? { ...c, status: "cancelled" as const } : c)),
        );

        showSuccess("Campaign cancelled. Contributors can now claim full refunds.");
      } catch (error) {
        showError(getAsyncActionErrorMessage(error, parseContractError));
      }
    },
    [userWalletAddress, showWarning, showSuccess, showError],
  );

  // -------------------------------------------------------------------------
  // Claim refund handler
  // -------------------------------------------------------------------------

  const handleClaimRefund = useCallback(
    async (campaignId: number) => {
      if (!userWalletAddress) {
        showWarning("Please connect your wallet first.");
        return;
      }
      try {
        await withActionTimeout(claimRefund(campaignId, userWalletAddress));
        showSuccess("Refund claimed successfully. Funds will appear in your wallet shortly.");
      } catch (error) {
        showError(getAsyncActionErrorMessage(error, parseContractError));
      }
    },
    [userWalletAddress, showWarning, showSuccess, showError],
  );

  const handleTagClick = useCallback((nextTag: string) => {
    setTag(nextTag);
  }, []);

  const campaignsMatchingNonCategoryFilters = useMemo(() => {
    let result = [...campaigns];

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          fuzzyMatch(c.title.toLowerCase(), q) ||
          fuzzyMatch(c.description.toLowerCase(), q) ||
          fuzzyMatch((CATEGORY_LABELS[c.category] ?? "").toLowerCase(), q) ||
          c.tags?.some((t) => fuzzyMatch(t.toLowerCase(), q)),
      );
    }

    if (status !== "all") result = result.filter((c) => c.status === status);
    if (tag) result = result.filter((c) => c.tags?.includes(tag));

    return result;
  }, [campaigns, debouncedSearch, status, tag]);

  const categoryCounts = useMemo(() => {
    const perCategory = Object.fromEntries(CATEGORY_VALUES.map((cat) => [cat, 0])) as Record<
      Category,
      number
    >;

    for (const campaign of campaignsMatchingNonCategoryFilters) {
      perCategory[campaign.category] += 1;
    }

    return {
      all: campaignsMatchingNonCategoryFilters.length,
      ...perCategory,
    };
  }, [campaignsMatchingNonCategoryFilters]);

  const isCategorySelected = useCallback(
    (cat: CategoryFilter) => (cat === "all" ? category === "all" : category === String(cat)),
    [category],
  );

  // -------------------------------------------------------------------------
  // Filtering + sorting
  // -------------------------------------------------------------------------

  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns];

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          fuzzyMatch(c.title.toLowerCase(), q) ||
          fuzzyMatch(c.description.toLowerCase(), q) ||
          fuzzyMatch((CATEGORY_LABELS[c.category] ?? "").toLowerCase(), q) ||
          c.tags?.some((t) => fuzzyMatch(t.toLowerCase(), q)),
      );
    }

    if (category !== "all") result = result.filter((c) => String(c.category) === category);
    if (status !== "all") result = result.filter((c) => c.status === status);
    if (tag) result = result.filter((c) => c.tags?.includes(tag));

    switch (sort) {
      case "oldest":
        result.sort((a, b) => a.deadline - b.deadline);
        break;
      case "most_voted": {
        result.sort((a, b) => {
          const aTotal = voteCounts[b.id]?.totalVotes ?? 0;
          const bTotal = voteCounts[a.id]?.totalVotes ?? 0;
          return aTotal - bTotal;
        });
        break;
      }
      case "most_funded":
        result.sort((a, b) => Number(b.amount_raised - a.amount_raised));
        break;
      case "approval_rate": {
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
  }, [campaigns, debouncedSearch, category, status, sort, tag, voteCounts]);

  // Group filtered campaigns into virtual rows according to the current
  // breakpoint column count.
  const rows = useMemo(() => {
    const result: Campaign[][] = [];
    for (let i = 0; i < filteredCampaigns.length; i += columns) {
      result.push(filteredCampaigns.slice(i, i + columns));
    }
    return result;
  }, [filteredCampaigns, columns]);

  const hasActiveFilters =
    debouncedSearch || category !== "all" || status !== "all" || sort !== "newest" || tag;

  const clearFilters = () => {
    setRawSearch("");
    setCategory("all");
    setStatus("all");
    setSort("newest");
    setTag("");
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
            {t("pageTitle")}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">{t("pageSubtitle")}</p>
          {tag && (
            <div className="flex items-center gap-2 mt-4 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg w-fit">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Filter: #{tag}
              </span>
              <button
                onClick={() => setTag("")}
                className="ms-1 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 transition-colors"
                aria-label="Clear tag filter"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Search + filters bar */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 mb-6 space-y-3">
          {/* Search */}
          <div className="relative" role="search">
            <svg
              className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              id="causes-search"
              type="search"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              autoComplete="off"
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {rawSearch && (
              <button
                onClick={() => setRawSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category filter chips */}
          {!isLoading && !error && (
            <div role="group" aria-label={t("labelCategory")} className="flex flex-wrap gap-2">
              {(["all", ...CATEGORY_VALUES] as CategoryFilter[]).map((cat) => {
                const selected = isCategorySelected(cat);
                const count = cat === "all" ? categoryCounts.all : categoryCounts[cat as Category];
                const label =
                  cat === "all"
                    ? t("allCategories")
                    : `${CATEGORY_ICONS[cat]} ${CATEGORY_LABELS[cat]}`;
                const accessibleName =
                  cat === "all" ? t("allCategories") : CATEGORY_LABELS[cat as Category];

                return (
                  <button
                    key={String(cat)}
                    type="button"
                    aria-pressed={selected}
                    aria-label={t(
                      selected ? "categoryChipAriaSelected" : "categoryChipAriaUnselected",
                      { label: accessibleName, count },
                    )}
                    onClick={() => setCategory(cat === "all" ? "all" : String(cat))}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      selected
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                    }`}
                  >
                    <span aria-hidden="true">{label}</span>
                    <span
                      className={`tabular-nums text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                        selected
                          ? "bg-blue-500 text-white"
                          : "bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300"
                      }`}
                      aria-hidden="true"
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Filter row */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap w-16 sm:w-auto">
                {t("labelStatus")}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="flex-1 sm:flex-none text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? t("allStatuses") : s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap w-16 sm:w-auto">
                {t("labelSortBy")}
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="flex-1 sm:flex-none text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline ms-auto"
              >
                {t("clearFilters")}
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
              {t("tryAgain")}
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
            <div
              aria-live="polite"
              aria-atomic="true"
              className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 flex items-center gap-3"
            >
              <span>
                {t(filteredCampaigns.length === 1 ? "causesFound_one" : "causesFound_other", {
                  count: filteredCampaigns.length,
                })}
                {debouncedSearch && <span>{t("causesFoundFor", { query: debouncedSearch })}</span>}
              </span>
              {isVotingFor !== null && (
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block motion-safe:animate-spin rounded-full h-3 w-3 border-b border-zinc-500" />
                  {t("processingVote")}
                </span>
              )}
            </div>

            {filteredCampaigns.length > 0 ? (
              <>
                {!isAllLoaded && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                    {t("loadingRange", {
                      shown: campaigns.length,
                      total: isAllLoaded
                        ? filteredCampaigns.length
                        : campaigns.length + CAMPAIGNS_CHUNK_SIZE,
                    })}
                  </p>
                )}
                <div ref={scrollRef}>
                  <CampaignVirtualGrid
                    rows={rows}
                    columns={columns}
                    userWalletAddress={userWalletAddress}
                    handleVote={handleVote}
                    handleCancel={handleCancel}
                    handleClaimRefund={handleClaimRefund}
                    handleTagClick={handleTagClick}
                    userVotes={userVotes}
                    voteCounts={voteCounts}
                    scrollMargin={scrollMargin}
                  />
                </div>
                {!isAllLoaded && (
                  <div className="mt-8 flex justify-center">
                    <div className="inline-flex items-center gap-2 px-6 py-2.5 text-sm text-zinc-500 dark:text-zinc-400">
                      <span className="inline-block motion-safe:animate-spin rounded-full h-4 w-4 border-2 border-zinc-300 border-t-blue-600" />
                      {t("loadingMore")}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">
                  {campaigns.length === 0 ? "📭" : debouncedSearch ? "🔍" : "🔎"}
                </div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                  {campaigns.length === 0
                    ? t("noCausesYet")
                    : debouncedSearch
                      ? t("noSearchResults")
                      : t("noCausesFound")}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                  {campaigns.length === 0
                    ? t("beFirstToSubmit")
                    : debouncedSearch
                      ? t("tryDifferentSearch")
                      : t("tryDifferentKeyword")}
                </p>
                {campaigns.length > 0 && (
                  <button
                    onClick={clearFilters}
                    className="px-6 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    {t("clearAllFilters")}
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

/** Renders the campaign grid using a window virtualizer for DOM efficiency. */
function CampaignVirtualGrid({
  rows,
  columns,
  userWalletAddress,
  handleVote,
  handleCancel,
  handleClaimRefund,
  handleTagClick,
  userVotes,
  voteCounts,
  scrollMargin,
}: {
  rows: Campaign[][];
  columns: number;
  userWalletAddress: string | null;
  handleVote: (campaignId: number, voteType: "upvote" | "downvote") => Promise<void>;
  handleCancel: (campaignId: number) => Promise<void>;
  handleClaimRefund: (campaignId: number) => Promise<void>;
  handleTagClick: (tag: string) => void;
  userVotes: Record<string, Vote>;
  voteCounts: Record<number, { upvotes: number; downvotes: number; totalVotes: number }>;
  scrollMargin: number;
}) {
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 400,
    overscan: 3,
    scrollMargin,
  });

  return (
    <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const rowCampaigns = rows[virtualRow.index];
        return (
          <div
            key={virtualRow.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {rowCampaigns.map((campaign) => (
              <CauseCard
                key={campaign.id}
                campaign={campaign}
                userWalletAddress={userWalletAddress}
                onVote={handleVote}
                onCancel={handleCancel}
                onClaimRefund={handleClaimRefund}
                onTagClick={handleTagClick}
                userVote={userVotes[campaign.id]}
                upvotes={voteCounts[campaign.id]?.upvotes ?? 0}
                downvotes={voteCounts[campaign.id]?.downvotes ?? 0}
                totalVotes={voteCounts[campaign.id]?.totalVotes ?? 0}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function CausesClient() {
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

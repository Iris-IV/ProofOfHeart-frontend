'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Cause, Vote } from '../../types';
import { mockCauses, CATEGORIES, STATUSES, SORT_OPTIONS } from '../../lib/mockCauses';
import { stellarVotingService } from '../../services/stellarVoting';
import CauseCard from '../../components/CauseCard';
import WalletConnection from '../../components/WalletConnection';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function CausesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialise state from URL params
  const [rawSearch, setRawSearch] = useState(searchParams.get('q') ?? '');
  const [category, setCategory] = useState(searchParams.get('category') ?? 'all');
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all');
  const [sort, setSort] = useState(searchParams.get('sort') ?? 'newest');

  const debouncedSearch = useDebounce(rawSearch, 300);

  const [causes, setCauses] = useState<Cause[]>(mockCauses);
  const [userWalletAddress, setUserWalletAddress] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, Vote>>({});
  const [isVotingFor, setIsVotingFor] = useState<string | null>(null);

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

  // Load user votes when wallet connects
  const loadUserVotes = useCallback(() => {
    if (!userWalletAddress) return;
    const votes: Record<string, Vote> = {};
    for (const cause of causes) {
      const v = stellarVotingService.getUserVote(cause.id, userWalletAddress);
      if (v) {
        votes[cause.id] = {
          causeId: cause.id,
          voter: userWalletAddress,
          voteType: v.voteType,
          timestamp: v.timestamp,
          transactionHash: 'mock-hash',
        };
      }
    }
    setUserVotes(votes);
  }, [userWalletAddress, causes]);

  useEffect(() => {
    if (userWalletAddress) loadUserVotes();
  }, [userWalletAddress, loadUserVotes]);

  const handleWalletConnected = (publicKey: string) => setUserWalletAddress(publicKey);
  const handleWalletDisconnected = () => {
    setUserWalletAddress(null);
    setUserVotes({});
  };

  const handleVote = async (causeId: string, voteType: 'upvote' | 'downvote') => {
    if (!userWalletAddress) { alert('Please connect your wallet first'); return; }
    if (stellarVotingService.hasUserVoted(causeId, userWalletAddress)) {
      alert('You have already voted on this cause'); return;
    }
    setIsVotingFor(causeId);
    try {
      const transactionHash = await stellarVotingService.castVote(causeId, voteType, userWalletAddress);
      const newVote: Vote = { causeId, voter: userWalletAddress, voteType, timestamp: new Date(), transactionHash };
      setUserVotes(prev => ({ ...prev, [causeId]: newVote }));
      setCauses(prev => prev.map(c =>
        c.id === causeId
          ? { ...c,
              upvotes: voteType === 'upvote' ? c.upvotes + 1 : c.upvotes,
              downvotes: voteType === 'downvote' ? c.downvotes + 1 : c.downvotes,
              totalVotes: c.totalVotes + 1 }
          : c
      ));
    } catch {
      alert('Failed to cast vote. Please try again.');
    } finally {
      setIsVotingFor(null);
    }
  };

  // Filter + sort pipeline
  const filteredCauses = useMemo(() => {
    let result = [...causes];

    // Keyword search across title, description, category
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        c =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      );
    }

    if (category !== 'all') result = result.filter(c => c.category === category);
    if (status !== 'all') result = result.filter(c => c.status === status);

    switch (sort) {
      case 'oldest':
        result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case 'most_voted':
        result.sort((a, b) => b.totalVotes - a.totalVotes);
        break;
      case 'most_funded':
        result.sort((a, b) => (b.currentAmount ?? 0) - (a.currentAmount ?? 0));
        break;
      case 'approval_rate':
        result.sort((a, b) => {
          const aRate = a.totalVotes > 0 ? a.upvotes / a.totalVotes : 0;
          const bRate = b.totalVotes > 0 ? b.upvotes / b.totalVotes : 0;
          return bRate - aRate;
        });
        break;
      default: // newest
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return result;
  }, [causes, debouncedSearch, category, status, sort]);

  const hasActiveFilters =
    debouncedSearch || category !== 'all' || status !== 'all' || sort !== 'newest';

  const clearFilters = () => {
    setRawSearch('');
    setCategory('all');
    setStatus('all');
    setSort('newest');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
      <main className="container mx-auto px-4 py-8">
        {/* Page heading */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Community Causes</h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Browse, search, and vote on causes that matter to you.
            </p>
          </div>
          <WalletConnection
            onWalletConnected={handleWalletConnected}
            onWalletDisconnected={handleWalletDisconnected}
          />
        </div>

        {/* Search + filters bar */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 mb-6 space-y-3">
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={rawSearch}
              onChange={e => setRawSearch(e.target.value)}
              placeholder="Search causes by title, description, or category…"
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
            {/* Category */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sort by</label>
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-auto"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          {filteredCauses.length} {filteredCauses.length === 1 ? 'cause' : 'causes'} found
          {debouncedSearch && <span> for &ldquo;{debouncedSearch}&rdquo;</span>}
          {isVotingFor && (
            <span className="ml-3 inline-flex items-center gap-1">
              <span className="inline-block animate-spin rounded-full h-3 w-3 border-b border-zinc-500" />
              Processing vote…
            </span>
          )}
        </div>

        {/* Grid */}
        {filteredCauses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCauses.map(cause => (
              <CauseCard
                key={cause.id}
                cause={cause}
                userWalletAddress={userWalletAddress}
                onVote={handleVote}
                userVote={userVotes[cause.id]}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">No causes found</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Try a different keyword or clear the filters.
            </p>
            <button
              onClick={clearFilters}
              className="px-6 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CausesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <CausesContent />
    </Suspense>
  );
}

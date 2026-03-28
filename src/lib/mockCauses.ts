/**
 * @deprecated Mock campaign data has been moved to `src/lib/contractClient.ts`
 * and is gated behind the `NEXT_PUBLIC_USE_MOCKS=true` environment variable.
 *
 * This file now only exports the UI filter constants (CATEGORIES, STATUSES,
 * SORT_OPTIONS) which are not mock data and remain safe to import.
 *
 * Do NOT add new mock data here. Use contractClient.ts instead.
 */

export const CATEGORIES = ['all', 'environment', 'education', 'healthcare'] as const;
export const STATUSES = ['all', 'pending', 'approved', 'rejected'] as const;
export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'most_voted', label: 'Most Voted' },
  { value: 'most_funded', label: 'Most Funded' },
  { value: 'approval_rate', label: 'Highest Approval' },
] as const;

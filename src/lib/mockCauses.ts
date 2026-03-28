/**
 * UI filter constants used by listing pages.
 *
 * Mock campaign data lives in `src/lib/contractClient.ts` and is gated behind
 * the `NEXT_PUBLIC_USE_MOCKS=true` environment variable.
 */

import { Category, CATEGORY_LABELS, CampaignStatus } from '../types';

/** Category options for filter dropdowns (enum value → label). */
export const CATEGORIES = ['all', ...Object.values(CATEGORY_LABELS)] as const;

/** Status options for filter dropdowns. */
export const STATUSES: readonly ('all' | CampaignStatus)[] = [
  'all',
  'active',
  'funded',
  'failed',
  'cancelled',
  'verified',
] as const;

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'most_voted', label: 'Most Voted' },
  { value: 'most_funded', label: 'Most Funded' },
  { value: 'approval_rate', label: 'Highest Approval' },
] as const;

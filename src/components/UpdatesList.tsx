'use client';

import { Skeleton } from '@/components/Skeleton';
import UpdateItem from '@/components/UpdateItem';
import { CampaignUpdate } from '@/types';

interface UpdatesListProps {
  updates: CampaignUpdate[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Renders a list of campaign updates in reverse chronological order.
 * Handles loading, error, and empty states.
 */
export default function UpdatesList({ updates, isLoading, error }: UpdatesListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="w-32 h-4" />
                <Skeleton className="w-20 h-3" />
              </div>
            </div>
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-5/6 h-4" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
        <p className="text-amber-700 dark:text-amber-400 text-sm">
          ⚠️ Failed to load updates. Please try again later.
        </p>
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-zinc-400 dark:text-zinc-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
          No updates yet
        </h3>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          The creator hasn&apos;t posted any updates. Check back later for news and progress!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" role="feed" aria-label="Campaign updates">
      {updates.map((update) => (
        <UpdateItem key={update.id} update={update} />
      ))}
    </div>
  );
}

"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  /** Optional: label override for the Previous button */
  prevLabel?: string;
  /** Optional: label override for the Next button */
  nextLabel?: string;
  className?: string;
}

/**
 * Generic prev/next pagination control.
 * Next is disabled when currentPage === totalPages.
 * Prev is disabled when currentPage === 1.
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPrev,
  onNext,
  prevLabel = "← Previous",
  nextLabel = "Next →",
  className = "",
}: PaginationProps) {
  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages;

  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <button
        type="button"
        onClick={onPrev}
        disabled={isFirst}
        aria-label="Go to previous page"
        className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {prevLabel}
      </button>

      <span className="text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
        {currentPage} / {totalPages}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={isLast}
        aria-label="Go to next page"
        className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {nextLabel}
      </button>
    </div>
  );
}

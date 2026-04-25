
interface SkeletonProps {
    className?: string;
}

/** Single animated skeleton block */
export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <div
            className={`motion-safe:animate-pulse rounded bg-zinc-200 dark:bg-zinc-700 ${className}`}
        />
    );
}

/** Skeleton for a cause card in the grid */
export function CauseCardSkeleton() {
    return (
        <div className="flex flex-col bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="p-5 flex-1 space-y-3">
                <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-2 w-full rounded-full mt-4" />
            </div>
            <div className="px-5 pb-5">
                <Skeleton className="h-24 w-full rounded-lg" />
            </div>
        </div>
    );
}

/** Skeleton for a row in the explore list */
export function CampaignRowSkeleton() {
    return (
        <div className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full shrink-0" />
        </div>
    );
}

/** Skeleton for the cause detail page */
export function CauseDetailSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
            <main className="container mx-auto px-4 py-8 max-w-5xl">
                <Skeleton className="h-4 w-48 mb-6" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-4">
                            <div className="flex gap-3">
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="h-5 w-16" />
                            </div>
                            <Skeleton className="h-8 w-3/4" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                            <Skeleton className="h-4 w-4/6" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                                    <Skeleton className="h-8 w-12 mx-auto mb-2" />
                                    <Skeleton className="h-3 w-16 mx-auto" />
                                </div>
                            ))}
                        </div>
                        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-3">
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-3">
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-2 w-full rounded-full" />
                        </div>
                    </div>
                    {/* Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-4">
                            <Skeleton className="h-5 w-32" />
                            <div className="flex gap-3 justify-center">
                                <Skeleton className="h-10 w-28 rounded-full" />
                                <Skeleton className="h-10 w-28 rounded-full" />
                            </div>
                        </div>
                        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-3">
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-12 w-full rounded-xl" />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

/** Skeleton for the dashboard page */
export function DashboardSkeleton() {
    return (
        <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
            <Skeleton className="h-9 w-48" />
            {/* Balance */}
            <div className="space-y-3">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-10 w-48 rounded-xl" />
            </div>
            {/* Submitted causes */}
            <div className="space-y-3">
                <Skeleton className="h-6 w-48" />
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="border rounded-xl p-4 bg-white dark:bg-zinc-800 space-y-2">
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="h-4 w-full" />
                    </div>
                ))}
            </div>
            {/* History */}
            <div className="space-y-3">
                <Skeleton className="h-6 w-36" />
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="border rounded-xl p-4 bg-white dark:bg-zinc-800 space-y-2">
                        <Skeleton className="h-5 w-1/2" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Inline spinner for buttons / transaction pending states */
export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
    return (
        <svg
            className={`motion-safe:animate-spin ${className}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
        </svg>
    );
}

/** Full-page centered spinner */
export function PageSpinner() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Loading">
            <Spinner className="h-8 w-8 text-blue-600" />
        </div>
    );
}

// Re-export a named group for convenience
export const SkeletonComponents = {
    CauseCard: CauseCardSkeleton,
    CampaignRow: CampaignRowSkeleton,
    CauseDetail: CauseDetailSkeleton,
    Dashboard: DashboardSkeleton,
} as const;

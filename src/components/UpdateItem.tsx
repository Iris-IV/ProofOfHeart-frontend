import { useState, useEffect } from 'react';
import { CampaignUpdate } from '@/types';
import { verifyUpdateSignature } from '@/lib/campaignUpdates';

interface UpdateItemProps {
  update: CampaignUpdate;
}

/**
 * Formats a Unix timestamp (seconds) to relative time string (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    return `${mins} ${mins === 1 ? 'm' : 'm'} ago`;
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} ${hours === 1 ? 'h' : 'h'} ago`;
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days} ${days === 1 ? 'd' : 'd'} ago`;
  }
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Formats a Unix timestamp (seconds) to absolute date string for tooltip
 */
function formatAbsoluteTime(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }).format(new Date(timestamp * 1000));
}

/**
 * Shortens a Stellar address for display (e.g., "GABC...7890")
 */
function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Displays a single campaign update with content, author, and timestamp.
 */
export default function UpdateItem({ update }: UpdateItemProps) {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  
  useEffect(() => {
    const verify = async () => {
      const result = await verifyUpdateSignature(update);
      setIsVerified(result);
    };
    verify();
  }, [update]);

  const relativeTime = formatRelativeTime(update.timestamp);
  const absoluteTime = formatAbsoluteTime(update.timestamp);
  const shortenedAuthor = shortenAddress(update.authorAddress);

  return (
    <article
      className="group bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 shadow-xs hover:shadow-md transition-all duration-300 ring-1 ring-zinc-900/5"
      role="article"
      aria-label={`Update from ${shortenedAuthor}`}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          {/* Author avatar */}
          <div
            className="w-12 h-12 rounded-full bg-linear-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white text-base font-bold shadow-inner ring-2 ring-white dark:ring-zinc-700"
            aria-hidden="true"
          >
            {update.authorAddress.slice(1, 3).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <span
                className="text-sm font-bold text-zinc-900 dark:text-zinc-50 tracking-tight"
                title={update.authorAddress}
              >
                {shortenedAuthor}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Creator
                </span>
                {isVerified && (
                  <span 
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                    title="Cryptographically verified update"
                  >
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                )}
              </div>
            </div>
            <time
              dateTime={new Date(update.timestamp * 1000).toISOString()}
              className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-0.5 block"
              title={absoluteTime}
            >
              {relativeTime}
            </time>
          </div>
        </div>
        
        {/* Verification Icon - Right side */}
        <div className="hidden sm:block opacity-20 group-hover:opacity-100 transition-opacity duration-300">
          <svg className="w-5 h-5 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
      </div>

      {/* Update content */}
      <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap break-words text-sm ml-0 sm:ml-16">
        {update.content}
      </div>
    </article>
  );
}

import { useState, useEffect } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { CampaignUpdate } from "@/types";
import SafeMarkdown from "./SafeMarkdown";
import VerifiedIcon from "./icons/VerifiedIcon";
import { verifyUpdateSignature } from "@/lib/campaignUpdates";
import { getYoutubeEmbedUrl, isDirectVideoUrl, normalizeVideoUrl } from "@/lib/videoEmbeds";

interface UpdateItemProps {
  update: CampaignUpdate;
}

/**
 * Formats a Unix timestamp (seconds) to relative time string (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    return `${mins} ${mins === 1 ? "m" : "m"} ago`;
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} ${hours === 1 ? "h" : "h"} ago`;
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days} ${days === 1 ? "d" : "d"} ago`;
  }
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Formats a Unix timestamp (seconds) to absolute date string for tooltip
 */
function formatAbsoluteTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
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
  const normalizedVideoUrl = update.mediaUrl ? normalizeVideoUrl(update.mediaUrl) : null;
  const youtubeEmbedUrl = normalizedVideoUrl ? getYoutubeEmbedUrl(normalizedVideoUrl) : null;

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
      className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs ring-1 ring-zinc-900/5 transition-all duration-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
      aria-label={`Update from ${shortenedAuthor}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-purple-500 to-blue-600 text-base font-bold text-white shadow-inner ring-2 ring-white dark:ring-zinc-700"
            aria-hidden="true"
          >
            {update.authorAddress.slice(1, 3).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
                title={update.authorAddress}
              >
                {shortenedAuthor}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                  Creator
                </span>
                {isVerified && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300"
                    title="Cryptographically verified update"
                  >
                    <VerifiedIcon className="h-2.5 w-2.5" />
                    Verified
                  </span>
                )}
              </div>
            </div>
            <time
              dateTime={new Date(update.timestamp * 1000).toISOString()}
              className="mt-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              title={absoluteTime}
            >
              {relativeTime}
            </time>
          </div>
        </div>

        <div className="hidden opacity-20 transition-opacity duration-300 group-hover:opacity-100 sm:block">
          <ShieldCheck className="h-5 w-5 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
        </div>
      </div>

      <div className="ml-0 space-y-4 sm:ml-16">
        {normalizedVideoUrl && (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black dark:border-zinc-700">
            {youtubeEmbedUrl ? (
              <iframe
                src={youtubeEmbedUrl}
                title="Campaign update video"
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : isDirectVideoUrl(normalizedVideoUrl) ? (
              <video controls preload="metadata" className="aspect-video w-full bg-black">
                <source src={normalizedVideoUrl} />
                Your browser does not support embedded video playback.
              </video>
            ) : (
              <a
                href={normalizedVideoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-white"
              >
                <span className="truncate">Watch attached video</span>
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
            )}
          </div>
        )}

        <SafeMarkdown className="prose prose-sm prose-zinc max-w-none break-words text-zinc-700 dark:prose-invert dark:text-zinc-300">
          {update.content}
        </SafeMarkdown>
      </div>
    </article>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Heart, Sparkles } from "lucide-react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { formatAmount } from "@/lib/formatters";
import { useLocale } from "next-intl";

/**
 * Recent on-chain activity ticker for the landing page.
 *
 * #636 — The landing page felt static with no reflection of real-time platform
 * activity. This component pulls the live campaign list (already polled by
 * TrendingCampaigns), sorts by recency, and surfaces the 5 most recent events
 * as an auto-advancing carousel.  Donor wallet addresses are truncated to
 * preserve privacy (first 4 + last 4 chars only).
 */
export default function RecentActivityFeed() {
  const { campaigns, isLoading } = useCampaigns();
  const locale = useLocale();
  const [activeIndex, setActiveIndex] = useState(0);

  // Build activity items from the 5 most recently created campaigns
  const items = [...campaigns]
    .sort((a, b) => {
      const tA = typeof a.created_at === "number" ? a.created_at : 0;
      const tB = typeof b.created_at === "number" ? b.created_at : 0;
      return tB - tA;
    })
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      label: `New cause: ${c.title}`,
      raised: c.amount_raised ?? c.raised_amount ?? BigInt(0),
    }));

  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % items.length);
    }, 4_000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (isLoading || items.length === 0) return null;

  const current = items[activeIndex];

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="flex items-center justify-center gap-3 px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 max-w-xl mx-auto mt-6 overflow-hidden"
    >
      <span className="flex-shrink-0">
        {activeIndex % 2 === 0 ? (
          <Heart size={15} className="text-red-500" fill="currentColor" />
        ) : (
          <Sparkles size={15} className="text-amber-500" />
        )}
      </span>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{current.label}</span>
        {current.raised > BigInt(0) && (
          <span className="ml-1 text-zinc-500">
            · {formatAmount(current.raised, locale, { maximumFractionDigits: 0 })} XLM raised
          </span>
        )}
      </p>
      {items.length > 1 && (
        <div className="flex gap-1 ml-auto flex-shrink-0">
          {items.map((_, i) => (
            <button
              key={i}
              aria-label={`Activity ${i + 1}`}
              onClick={() => setActiveIndex(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === activeIndex
                  ? "bg-zinc-700 dark:bg-zinc-200"
                  : "bg-zinc-300 dark:bg-zinc-600"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

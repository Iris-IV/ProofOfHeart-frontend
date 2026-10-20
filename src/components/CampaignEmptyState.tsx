"use client";

import { useId, type ReactNode } from "react";
import { Card } from "@/components/ui";

interface CampaignEmptyStateProps {
  variant: "search" | "bookmarks" | "campaigns";
  title: string;
  description: string;
  action: ReactNode;
  children?: ReactNode;
}

/** Decorative vector art inherits the theme and never needs an image download. */
export default function CampaignEmptyState({
  variant,
  title,
  description,
  action,
  children,
}: CampaignEmptyStateProps) {
  const titleId = useId();
  return (
    <Card
      as="section"
      aria-labelledby={titleId}
      className="campaign-empty-state relative isolate overflow-hidden border-brand/20 bg-linear-to-br from-brand-subtle/60 via-white/80 to-accent-subtle/60 text-center backdrop-blur-md dark:via-zinc-900/80"
    >
      <svg
        viewBox="0 0 200 140"
        className="mx-auto mb-4 h-auto w-40 max-w-full text-brand sm:w-48"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <ellipse cx="100" cy="122" rx="70" ry="9" fill="currentColor" opacity="0.08" />
        <circle cx="100" cy="66" r="54" fill="currentColor" opacity="0.06" />
        <rect x="44" y="36" width="75" height="78" rx="12" stroke="currentColor" strokeWidth="2" opacity="0.4" transform="rotate(-8 44 36)" />
        <rect x="66" y="27" width="75" height="87" rx="12" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="2" />
        <path d="M80 80h34M80 91h22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
        {variant === "bookmarks" ? (
          <path d="M91 27h26v38l-13-9-13 9V27Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        ) : variant === "search" ? (
          <g stroke="currentColor" strokeWidth="4" strokeLinecap="round">
            <circle cx="135" cy="84" r="20" />
            <path d="m150 99 18 18" />
          </g>
        ) : (
          <path d="M103 65 88 51c-12-14 7-26 15-12 8-14 27-2 15 12l-15 14Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
        )}
        <path d="M34 62h10m-5-5v10m118-38h10m-5-5v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </svg>
      <h2 id={titleId} className="text-heading-lg font-heading-lg text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 sm:text-base">
        {description}
      </p>
      {children}
      <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>
    </Card>
  );
}

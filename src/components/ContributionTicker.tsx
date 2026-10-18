"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Card } from "@/components/ui";
import Amount from "@/components/Amount";
import { formatAddress } from "@/lib/formatAddress";
import { formatAmount } from "@/lib/formatters";
import type { ContributionFeedEvent, ContributionFeedStatus } from "@/lib/contributionFeed";

interface ContributionTickerProps {
  events: ContributionFeedEvent[];
  status: ContributionFeedStatus;
}

export default function ContributionTicker({
  events = [],
  status = "connecting",
}: ContributionTickerProps) {
  const t = useTranslations("ContributionTicker");
  const locale = useLocale();
  const titleId = useId();
  const [pausedEvents, setPausedEvents] = useState<ContributionFeedEvent[] | null>(null);
  const paused = pausedEvents !== null;
  const displayed = pausedEvents ?? events;
  const latest = events[0];
  const latestAnnouncement = latest
    ? t("latest", {
        donor: latest.contributor ? formatAddress(latest.contributor) : t("supporter"),
        amount: formatAmount(latest.amount, locale, { maximumFractionDigits: 2 }),
      })
    : "";

  return (
    <Card
      as="section"
      aria-labelledby={titleId}
      className="min-w-0 border-brand/20 bg-linear-to-br from-brand-subtle/60 via-white/80 to-accent-subtle/50 backdrop-blur-md dark:via-zinc-900/80"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="text-heading font-heading text-zinc-900 dark:text-zinc-50">
          {t("title")}
        </h2>
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={paused}
          onClick={() => setPausedEvents(paused ? null : [...events])}
          className="duration-[120ms] motion-reduce:transition-none"
        >
          {paused ? t("resume") : t("pause")}
        </Button>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
        {t(paused ? "paused" : status)}
        {!paused && status === "live" && latest && <span className="sr-only"> {latestAnnouncement}</span>}
      </p>
      {displayed.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">{t("empty")}</p>
      ) : (
        <div
          role="region"
          aria-label={t("recent")}
          tabIndex={0}
          className="focus-ring mt-4 max-h-64 overflow-y-auto overscroll-contain rounded-control"
        >
          <ol className="space-y-2" aria-live="off">
            {displayed.map((event) => {
              const time = new Date(event.ledgerClosedAt);
              const validTime = Number.isFinite(time.getTime());
              return (
                <li key={event.id} className="contribution-ticker-entry flex flex-wrap items-center justify-between gap-2 rounded-control border border-brand/15 bg-white/70 p-3 text-sm dark:bg-zinc-900/70">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {event.contributor ? formatAddress(event.contributor) : t("supporter")}
                    </p>
                    {validTime && (
                      <time dateTime={time.toISOString()} className="text-xs text-zinc-500 dark:text-zinc-400">
                        {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(time)}
                      </time>
                    )}
                  </div>
                  <span className="break-all font-semibold tabular-nums text-brand">
                    +<Amount value={event.amount} maximumFractionDigits={2} /> XLM
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Card>
  );
}

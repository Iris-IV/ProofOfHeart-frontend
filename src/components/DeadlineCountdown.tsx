"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useLocale } from "next-intl";
import { subscribeToCountdownTick } from "@/hooks/useCountdownTick";

interface DeadlineCountdownProps {
  deadline: number; // Unix timestamp in seconds
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
}

function getTimeLeft(deadline: number): TimeLeft | null {
  const diff = deadline - Math.floor(Date.now() / 1000);
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
  };
}

export default function DeadlineCountdown({ deadline }: DeadlineCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => getTimeLeft(deadline));
  const locale = useLocale();

  useEffect(() => {
    return subscribeToCountdownTick(() => {
      setTimeLeft((prev) => {
        // Already ended — cheap no-op on future ticks
        if (prev === null) return null;

        const next = getTimeLeft(deadline);
        if (!next) return null;

        // When days ≥ 1, the display shows "Xd Xh" only (no minutes).
        // Skip re-render unless days or hours actually changed.
        const farDeadline = next.days >= 1;
        if (
          prev.days === next.days &&
          prev.hours === next.hours &&
          (farDeadline || prev.minutes === next.minutes)
        ) {
          return prev; // bail out — React won't schedule a re-render
        }

        return next;
      });
    });
  }, [deadline]);

  // Base classes shared by both states. `glass-surface` is the frosted panel from globals.css.
  // Text sizes step up at sm (640px) so the pill stays readable from 320px to desktop.
  const containerBase =
    "glass-surface inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm";

  if (!timeLeft) {
    return (
      <div className={`${containerBase} text-zinc-500 dark:text-zinc-400`}>
        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Campaign ended</span>
      </div>
    );
  }

  const format = (value: number) => new Intl.NumberFormat(locale).format(value);

  // Each value is keyed by its number, so a change remounts the element and replays the
  // `countdown-digit` tick (under 150ms, disabled for prefers-reduced-motion).
  return (
    <div className={`${containerBase} text-zinc-700 dark:text-zinc-300`}>
      <Clock className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
      <span className="flex flex-wrap items-baseline gap-x-1">
        {timeLeft.days > 0 && (
          <>
            <strong key={`d-${timeLeft.days}`} className="countdown-digit tabular-nums">
              {format(timeLeft.days)}
            </strong>
            <span>d</span>
          </>
        )}
        <strong key={`h-${timeLeft.hours}`} className="countdown-digit tabular-nums">
          {format(timeLeft.hours)}
        </strong>
        <span>h</span>
        {/* Show minutes only when < 1 day remains; far deadlines only need hourly updates */}
        {timeLeft.days === 0 && (
          <>
            <strong key={`m-${timeLeft.minutes}`} className="countdown-digit tabular-nums">
              {format(timeLeft.minutes)}
            </strong>
            <span>m</span>
          </>
        )}
        <span>remaining</span>
      </span>
    </div>
  );
}

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

  if (!timeLeft) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        <Clock className="w-4 h-4" aria-hidden="true" />
        <span>Campaign ended</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
      <Clock className="w-4 h-4 text-blue-500" aria-hidden="true" />
      <span>
        {timeLeft.days > 0 && (
          <>
            <strong>{new Intl.NumberFormat(locale).format(timeLeft.days)}</strong>d{" "}
          </>
        )}
        <strong>{new Intl.NumberFormat(locale).format(timeLeft.hours)}</strong>h{" "}
        {/* Show minutes only when < 1 day remains; far deadlines only need hourly updates */}
        {timeLeft.days === 0 && (
          <>
            <strong>{new Intl.NumberFormat(locale).format(timeLeft.minutes)}</strong>m{" "}
          </>
        )}
        remaining
      </span>
    </div>
  );
}

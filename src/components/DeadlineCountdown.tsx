"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeLeft(deadline);
      setTimeLeft(remaining);
      if (!remaining) clearInterval(interval);
    }, 60_000); // update every minute

    return () => clearInterval(interval);
  }, [deadline]);

  if (!timeLeft) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>Campaign ended</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>
        {timeLeft.days > 0 && (
          <>
            <strong>{timeLeft.days}</strong>d{" "}
          </>
        )}
        <strong>{timeLeft.hours}</strong>h <strong>{timeLeft.minutes}</strong>m remaining
      </span>
    </div>
  );
}

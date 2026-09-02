"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { calculateFundingPercentage, Milestone } from "../types";
import { formatAmount } from "@/lib/formatters";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// Framer Motion is isolated here and only loaded when motion is wanted
const AnimatedProgressFill = dynamic(() => import("./AnimatedProgressFill"), {
  ssr: false,
});

interface FundingProgressBarProps {
  amountRaised: bigint;
  fundingGoal: bigint;
  milestones?: Milestone[];
}

export default function FundingProgressBar({
  amountRaised,
  fundingGoal,
  milestones,
}: FundingProgressBarProps) {
  const locale = useLocale();
  const targetPct = calculateFundingPercentage(amountRaised, fundingGoal);
  const prefersReducedMotion = useReducedMotion();

  const displayRaised = formatAmount(amountRaised, locale, { maximumFractionDigits: 2 });
  const displayGoal = formatAmount(fundingGoal, locale, { maximumFractionDigits: 2 });
  const roundedPct = Math.min(100, Math.round(targetPct));
  const fundingLabelId = useId();
  const milestoneIdPrefix = useId();
  const fundingValueText = `${roundedPct}% funded, ${displayRaised} of ${displayGoal} XLM`;

  // Hover alone leaves milestone details unreachable on touch devices, so the
  // markers are buttons that toggle their own tooltip open (#1154).
  const [openMilestone, setOpenMilestone] = useState<number | null>(null);
  const milestonesRef = useRef<HTMLDivElement>(null);
  // Empty when focus arrived from the keyboard rather than a pointer.
  const pointerTypeRef = useRef("");

  const closeMilestone = useCallback(() => setOpenMilestone(null), []);

  useEffect(() => {
    if (openMilestone === null) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!milestonesRef.current?.contains(event.target as Node)) closeMilestone();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMilestone();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMilestone, closeMilestone]);

  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
        <span id={fundingLabelId} className="font-medium">
          {roundedPct}% funded
        </span>
        <span>
          {displayRaised} / {displayGoal} XLM
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={fundingLabelId}
        aria-valuenow={Math.min(100, roundedPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={fundingValueText}
        className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden"
      >
        {prefersReducedMotion ? (
          // Instant static fill — no animation, no layout shift
          <div
            aria-hidden="true"
            className="bg-linear-to-r from-blue-500 to-purple-500 h-1.5 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, targetPct))}%` }}
          />
        ) : (
          // Spring-animated fill — Framer Motion chunk loads lazily
          <AnimatedProgressFill targetPct={targetPct} />
        )}
      </div>

      {milestones && milestones.length > 0 && fundingGoal > 0n && (
        <div ref={milestonesRef} className="relative mt-2 w-full h-4">
          {milestones.map((m, idx) => {
            const mPct = calculateFundingPercentage(m.targetAmount, fundingGoal);
            const visualPct = Math.min(100, Math.max(0, mPct));
            const isReached = amountRaised >= m.targetAmount;
            const isOpen = openMilestone === idx;
            const tooltipId = `${milestoneIdPrefix}-milestone-${idx}`;
            const targetLabel = formatAmount(m.targetAmount, locale, { maximumFractionDigits: 0 });

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setOpenMilestone(isOpen ? null : idx)}
                onPointerDown={(e) => {
                  pointerTypeRef.current = e.pointerType || "mouse";
                }}
                onPointerEnter={(e) => {
                  // Touch fires a synthetic enter before the tap; honouring it
                  // would open the tooltip and let the click close it again.
                  if (e.pointerType !== "touch") setOpenMilestone(idx);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType !== "touch") {
                    setOpenMilestone((cur) => (cur === idx ? null : cur));
                  }
                }}
                onFocus={() => {
                  // Only keyboard focus opens it; a tap must not race the click.
                  if (!pointerTypeRef.current) setOpenMilestone(idx);
                }}
                onBlur={() => {
                  pointerTypeRef.current = "";
                  setOpenMilestone((cur) => (cur === idx ? null : cur));
                }}
                aria-expanded={isOpen}
                aria-describedby={isOpen ? tooltipId : undefined}
                aria-label={`Milestone: ${targetLabel} XLM — ${m.description}`}
                // `before:` widens the 12px dot's hit area to a 32px touch
                // target (WCAG 2.5.8) without moving it or growing the row.
                className="absolute top-0 flex flex-col items-center -translate-x-1/2 z-10 touch-manipulation before:absolute before:left-1/2 before:top-1/2 before:size-8 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 rounded-full dark:focus-visible:ring-offset-zinc-900"
                style={{ left: `${visualPct}%` }}
              >
                {/* Marker dot */}
                <span
                  className={`w-3 h-3 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm transition-colors ${
                    isReached ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"
                  }`}
                />

                {isOpen && (
                  <span
                    id={tooltipId}
                    role="tooltip"
                    className="absolute top-5 block w-max max-w-[150px] bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] p-1.5 rounded-md pointer-events-none z-20 text-center shadow-lg"
                  >
                    <span className="block font-semibold">{targetLabel} XLM</span>
                    <span className="block line-clamp-2">{m.description}</span>
                    {/* Arrow */}
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-900 dark:border-b-zinc-100" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

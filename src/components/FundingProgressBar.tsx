"use client";

import { useId } from "react";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import { calculateFundingPercentage } from "../types";
import { formatAmount } from "@/lib/formatters";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// Framer Motion is isolated here and only loaded when motion is wanted
const AnimatedProgressFill = dynamic(() => import("./AnimatedProgressFill"), {
  ssr: false,
});

interface FundingProgressBarProps {
  amountRaised: bigint;
  fundingGoal: bigint;
}

export default function FundingProgressBar({ amountRaised, fundingGoal }: FundingProgressBarProps) {
  const locale = useLocale();
  const targetPct = calculateFundingPercentage(amountRaised, fundingGoal);
  const prefersReducedMotion = useReducedMotion();

  const displayRaised = formatAmount(amountRaised, locale, { maximumFractionDigits: 2 });
  const displayGoal = formatAmount(fundingGoal, locale, { maximumFractionDigits: 2 });
  const roundedPct = Math.round(targetPct);
  const fundingLabelId = useId();
  const fundingValueText = `${roundedPct}% funded, ${displayRaised} of ${displayGoal} XLM`;

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
        aria-valuenow={roundedPct}
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
            style={{ width: `${targetPct}%` }}
          />
        ) : (
          // Spring-animated fill — Framer Motion chunk loads lazily
          <AnimatedProgressFill targetPct={targetPct} />
        )}
      </div>
    </div>
  );
}

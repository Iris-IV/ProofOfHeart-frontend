"use client";

import { useEffect, useRef, useState, useId } from "react";
import { useLocale } from "next-intl";
import { motion, useSpring, useTransform } from "framer-motion";
import { calculateFundingPercentage, Milestone } from "../types";
import { formatAmount } from "@/lib/formatters";

interface FundingProgressBarProps {
  amountRaised: bigint;
  fundingGoal: bigint;
  milestones?: Milestone[];
}

export default function FundingProgressBar({ amountRaised, fundingGoal, milestones }: FundingProgressBarProps) {
  const locale = useLocale();
  const targetPct = calculateFundingPercentage(amountRaised, fundingGoal);

  const [displayPct, setDisplayPct] = useState(targetPct);
  const hasMountedRef = useRef(false);

  const springPct = useSpring(targetPct, { stiffness: 120, damping: 20, mass: 0.6 });
  const barWidth = useTransform(springPct, (value) => `${value}%`);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      setDisplayPct(targetPct);
      springPct.jump(targetPct);
      return;
    }
    springPct.set(targetPct);
    setDisplayPct(targetPct);
  }, [targetPct, springPct]);

  const displayRaised = formatAmount(amountRaised, locale, { maximumFractionDigits: 2 });
  const displayGoal = formatAmount(fundingGoal, locale, { maximumFractionDigits: 2 });
  const roundedPct = Math.round(displayPct);
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
        <motion.div
          aria-hidden="true"
          className="bg-linear-to-r from-blue-500 to-purple-500 h-1.5 rounded-full"
          style={{ width: barWidth }}
        />
      </div>

      {milestones && milestones.length > 0 && fundingGoal > 0n && (
        <div className="relative mt-2 w-full h-4">
          {milestones.map((m, idx) => {
            const mPct = calculateFundingPercentage(m.targetAmount, fundingGoal);
            const visualPct = Math.min(100, Math.max(0, mPct));
            const isReached = amountRaised >= m.targetAmount;
            
            return (
              <div 
                key={idx}
                className="absolute top-0 flex flex-col items-center -translate-x-1/2 group cursor-help z-10"
                style={{ left: `${visualPct}%` }}
              >
                {/* Marker dot */}
                <div className={`w-3 h-3 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm transition-colors ${
                  isReached ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                }`} />
                
                {/* Tooltip on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-5 w-max max-w-[150px] bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] p-1.5 rounded-md pointer-events-none z-20 text-center shadow-lg">
                  <p className="font-semibold">{formatAmount(m.targetAmount, locale, { maximumFractionDigits: 0 })} XLM</p>
                  <p className="line-clamp-2">{m.description}</p>
                  {/* Arrow */}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-900 dark:border-b-zinc-100" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

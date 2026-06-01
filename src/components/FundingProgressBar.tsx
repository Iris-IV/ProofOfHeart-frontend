"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { motion, useSpring, useTransform } from "framer-motion";
import { calculateFundingPercentage } from "../types";
import { formatAmount } from "@/lib/formatters";

interface FundingProgressBarProps {
  amountRaised: bigint;
  fundingGoal: bigint;
}

export default function FundingProgressBar({ amountRaised, fundingGoal }: FundingProgressBarProps) {
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

  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
        <span className="font-medium">{roundedPct}% funded</span>
        <span>
          {displayRaised} / {displayGoal} XLM
        </span>
      </div>
      <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className="bg-linear-to-r from-blue-500 to-purple-500 h-1.5 rounded-full"
          style={{ width: barWidth }}
        />
      </div>
    </div>
  );
}

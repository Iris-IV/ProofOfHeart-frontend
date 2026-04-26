'use client';

import { stroopsToXlm } from '../types';

interface FundingProgressBarProps {
  amountRaised: bigint;
  fundingGoal: bigint;
}

export default function FundingProgressBar({
  amountRaised,
  fundingGoal,
}: FundingProgressBarProps) {
  const raised = stroopsToXlm(amountRaised);
  const goal = stroopsToXlm(fundingGoal);
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
        <span className="font-medium">{pct}% funded</span>
        <span>
          {raised.toLocaleString(undefined, { maximumFractionDigits: 2 })} /{' '}
          {goal.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
        </span>
      </div>
      <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
        <div
          className="bg-linear-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

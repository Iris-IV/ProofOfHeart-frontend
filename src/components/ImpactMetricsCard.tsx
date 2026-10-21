"use client";

import { Heart, Users, TrendingUp, HandHeart, Share2 } from "lucide-react";
import { useLocale } from "next-intl";
import { formatNumber } from "@/lib/formatters";
import { useImpactMetrics } from "@/hooks/useImpactMetrics";
import type { Campaign } from "@/types";

interface ImpactMetricsProps {
  campaign: Campaign;
}

const METRIC_CONFIG = [
  {
    key: "estimatedLivesImpacted" as const,
    label: "Lives Impacted",
    icon: Heart,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
  },
  {
    key: "communityReach" as const,
    label: "Community Reach",
    icon: Users,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    key: "donorCount" as const,
    label: "Est. Donors",
    icon: HandHeart,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    key: "socialAmplification" as const,
    label: "Social Amplification",
    icon: Share2,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
] as const;

export default function ImpactMetricsCard({ campaign }: ImpactMetricsProps) {
  const locale = useLocale();
  const metrics = useImpactMetrics(campaign);

  if (!metrics) return null;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-white/60 bg-linear-to-br from-white/85 via-white/75 to-emerald-50/80 p-4 shadow-[0_20px_60px_-20px_rgba(16,24,40,0.28)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_-18px_rgba(16,24,40,0.32)] dark:border-zinc-700/70 dark:from-zinc-800/90 dark:via-zinc-800/80 dark:to-emerald-950/30 sm:p-5 animate-in fade-in"
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-emerald-300/80 to-transparent dark:via-emerald-500/60" />
      <div className="flex items-center gap-2.5 pb-3.5">
        <div className="flex size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 shadow-sm ring-1 ring-emerald-500/20 dark:text-emerald-300">
          <TrendingUp size={18} />
        </div>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-lg">
          Impact Metrics
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {METRIC_CONFIG.map(({ key, label, icon: Icon, color, bg }) => (
          <div
            key={key}
            className="group/tile flex items-center gap-3 rounded-2xl border border-zinc-200/70 bg-white/70 p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200/70 hover:bg-white/80 dark:border-zinc-700/60 dark:bg-zinc-900/50 dark:hover:border-emerald-500/30 dark:hover:bg-zinc-900/70"
          >
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${bg} ring-1 ring-inset ring-white/40 dark:ring-zinc-800/60`}>
              <Icon size={16} className={color} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {formatNumber(metrics[key], locale)}
              </div>
              <div className="truncate text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-emerald-100/80 bg-emerald-50/80 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-zinc-600 dark:text-zinc-300">Funding Efficiency</span>
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
            {Math.round(metrics.fundingEfficiency)}%
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-700/80">
          <div
            className="h-full rounded-full bg-linear-to-r from-emerald-400 via-emerald-500 to-teal-500 shadow-[0_0_18px_rgba(16,185,129,0.35)] transition-all duration-500"
            style={{ width: `${Math.min(100, metrics.fundingEfficiency)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { Heart, Users, TrendingUp, HandHeart, Share2 } from "lucide-react";
import { useLocale } from "next-intl";
import { formatNumber } from "@/lib/formatters";
import { useImpactMetrics, type ImpactMetrics as ImpactMetricsData } from "@/hooks/useImpactMetrics";
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
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} className="text-emerald-500" />
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Impact Metrics</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {METRIC_CONFIG.map(({ key, label, icon: Icon, color, bg }) => (
          <div key={key} className="flex items-center gap-3 rounded-lg border border-zinc-100 dark:border-zinc-700/50 p-3">
            <div className={`flex items-center justify-center size-9 rounded-full ${bg} shrink-0`}>
              <Icon size={16} className={color} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate">
                {formatNumber(metrics[key], locale)}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{label}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-700/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Funding Efficiency</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {Math.round(metrics.fundingEfficiency)}%
          </span>
        </div>
        <div className="mt-1.5 w-full bg-zinc-100 dark:bg-zinc-700 rounded-full h-1.5">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, metrics.fundingEfficiency)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

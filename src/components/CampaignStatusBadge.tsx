"use client";

import { useTranslations } from "next-intl";
import { Campaign, CampaignStatus, deriveCampaignStatus } from "../types";
import Badge from "./ui/Badge";
import VerifiedIcon from "./icons/VerifiedIcon";
import {
  PlayCircle,
  XCircle,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

/**
 * Cause status badges must not rely on color alone (WCAG 1.4.1).
 * Each status pairs a distinct icon + visible text label with the tone color.
 */
const STATUS_CONFIG: Record<
  CampaignStatus,
  { key: CampaignStatus; className: string; Icon: React.ElementType }
> = {
  active: {
    key: "active",
    className:
      "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700",
    Icon: PlayCircle,
  },
  cancelled: {
    key: "cancelled",
    className:
      "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border border-dashed border-red-400 dark:border-red-600",
    Icon: XCircle,
  },
  funded: {
    key: "funded",
    className:
      "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700",
    Icon: CheckCircle,
  },
  failed: {
    key: "failed",
    className:
      "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border border-dotted border-amber-400 dark:border-amber-600",
    Icon: AlertCircle,
  },
  verified: {
    key: "verified",
    className:
      "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700",
    Icon: ShieldCheck,
  },
};

interface CampaignStatusBadgeProps {
  campaign: Campaign;
}

export default function CampaignStatusBadge({ campaign }: CampaignStatusBadgeProps) {
  const t = useTranslations("Status");
  const status = deriveCampaignStatus(campaign);
  const config = STATUS_CONFIG[status];
  const label = t(config.key);

  return (
    <span className="inline-flex items-center gap-1.5" role="status" aria-label={label}>
      <span
        className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.className}`}
        data-status={config.key}
      >
        <config.Icon className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{label}</span>
      </span>
      {campaign.is_verified && status !== "verified" && (
        <Badge tone="accent" size="sm" title={t("verifiedCampaign")}>
          <VerifiedIcon className="w-3 h-3" aria-hidden="true" />
          {t("verified")}
        </Badge>
      )}
    </span>
  );
}

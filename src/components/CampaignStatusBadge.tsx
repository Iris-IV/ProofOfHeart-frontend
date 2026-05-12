"use client";

import { useTranslations } from "next-intl";
import { Campaign, CampaignStatus, deriveCampaignStatus } from "../types";

const STATUS_CONFIG: Record<CampaignStatus, { key: CampaignStatus; className: string }> = {
  active: {
    key: "active",
    className: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
  },
  cancelled: {
    key: "cancelled",
    className: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
  },
  funded: {
    key: "funded",
    className: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
  },
  failed: {
    key: "failed",
    className: "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300",
  },
  verified: {
    key: "verified",
    className: "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
  },
};

interface CampaignStatusBadgeProps {
  campaign: Campaign;
}

export default function CampaignStatusBadge({ campaign }: CampaignStatusBadgeProps) {
  const t = useTranslations("Status");
  const status = deriveCampaignStatus(campaign);
  const config = STATUS_CONFIG[status];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.className}`}
      >
        {t(config.key)}
      </span>
      {campaign.is_verified && status !== "verified" && (
        <span
          className="shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
          title={t("verifiedCampaign")}
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          {t("verified")}
        </span>
      )}
    </span>
  );
}

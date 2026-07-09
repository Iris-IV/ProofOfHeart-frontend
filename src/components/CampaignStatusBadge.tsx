"use client";

import { useTranslations } from "next-intl";
import { Campaign, CampaignStatus, deriveCampaignStatus } from "../types";
import VerifiedIcon from "./icons/VerifiedIcon";

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
          <VerifiedIcon className="w-3 h-3" />
          {t("verified")}
        </span>
      )}
    </span>
  );
}

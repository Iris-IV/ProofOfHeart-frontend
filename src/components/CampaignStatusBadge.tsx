"use client";

import { useTranslations } from "next-intl";
import { Campaign, CampaignStatus, deriveCampaignStatus } from "../types";
import Badge, { BadgeTone } from "./ui/Badge";
import VerifiedIcon from "./icons/VerifiedIcon";

// Map each derived status to a design-system tone so every cause status badge
// follows the same visual language (see ui/Badge.tsx — tones are intents).
const STATUS_TONE: Record<CampaignStatus, BadgeTone> = {
  active: "brand",
  cancelled: "danger",
  funded: "success",
  failed: "neutral",
  verified: "accent",
};

interface CampaignStatusBadgeProps {
  campaign: Campaign;
}

export default function CampaignStatusBadge({ campaign }: CampaignStatusBadgeProps) {
  const t = useTranslations("Status");
  const status = deriveCampaignStatus(campaign);
  const tone = STATUS_TONE[status];

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={tone}>{t(status)}</Badge>
      {campaign.is_verified && status !== "verified" && (
        <Badge tone="accent" size="sm" title={t("verifiedCampaign")}>
          <VerifiedIcon className="w-3 h-3" />
          {t("verified")}
        </Badge>
      )}
    </span>
  );
}

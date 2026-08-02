"use client";

import { useState } from "react";
import { Campaign } from "@/types";
import CommentsSection from "@/components/CommentsSection";
import UpdatesSection from "@/components/UpdatesSection";
import ImpactReport from "@/components/ImpactReport";
import { Tabs, TabPanel } from "@/components/ui";
import { useTranslations } from "next-intl";

type CampaignTabId = "updates" | "comments" | "impact";

interface CampaignTabsProps {
  campaign: Campaign;
}

/**
 * Tabbed footer of the campaign detail page.
 *
 * Updates and the Q&A thread each pull their own list, so stacking both meant
 * every visitor paid for both queries and had to scroll past one to reach the
 * other. `TabPanel` unmounts the inactive panel, so only the open tab fetches.
 */
export default function CampaignTabs({ campaign }: CampaignTabsProps) {
  const t = useTranslations("CauseDetail");
  const [activeTab, setActiveTab] = useState<CampaignTabId>("updates");

  const tabs = [
    { id: "updates" as const, label: t("tabs.updates") },
    { id: "comments" as const, label: t("tabs.comments") },
    { id: "impact" as const, label: t("tabs.impact") },
  ];

  return (
    <div className="space-y-6">
      <Tabs
        tabs={tabs}
        activeId={activeTab}
        onChange={setActiveTab}
        label="Campaign updates and discussion"
        idPrefix="campaign"
      />

      <TabPanel tabId="updates" idPrefix="campaign" active={activeTab === "updates"}>
        <UpdatesSection campaign={campaign} />
      </TabPanel>

      <TabPanel tabId="comments" idPrefix="campaign" active={activeTab === "comments"}>
        <CommentsSection campaign={campaign} />
      </TabPanel>

      <TabPanel tabId="impact" idPrefix="campaign" active={activeTab === "impact"}>
        <ImpactReport campaign={campaign} />
      </TabPanel>
    </div>
  );
}

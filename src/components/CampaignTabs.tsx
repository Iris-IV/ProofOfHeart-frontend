"use client";

import { useState } from "react";
import { Campaign } from "@/types";
import CommentsSection from "@/components/CommentsSection";
import UpdatesSection from "@/components/UpdatesSection";
import { Tabs, TabPanel } from "@/components/ui";

type CampaignTabId = "updates" | "comments";

const TABS = [
  { id: "updates" as const, label: "Updates" },
  { id: "comments" as const, label: "Comments / Q&A" },
];

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
  const [activeTab, setActiveTab] = useState<CampaignTabId>("updates");

  return (
    <div className="space-y-6">
      <Tabs
        tabs={TABS}
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
    </div>
  );
}

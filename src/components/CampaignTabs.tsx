"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Campaign } from "@/types";
import CommentsSection from "@/components/CommentsSection";
import UpdatesSection from "@/components/UpdatesSection";
import { Tabs, TabPanel } from "@/components/ui";

type CampaignTabId = "updates" | "comments";

const TABS = [
  { id: "updates" as const, label: "Updates" },
  { id: "comments" as const, label: "Comments / Q&A" },
];

const LAST_VIEWED_STORAGE_PREFIX = "campaign_last_viewed_";

interface CampaignTabsProps {
  campaign: Campaign;
}

function getLastViewed(campaignId: number, tabId: CampaignTabId): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(`${LAST_VIEWED_STORAGE_PREFIX}${campaignId}_${tabId}`);
    if (raw) return Number(raw);
  } catch {
    // ignore corrupt data
  }
  return 0;
}

function setAllLastViewed(campaignId: number, timestamp: number): void {
  if (typeof window === "undefined") return;
  TABS.forEach((tab) => {
    localStorage.setItem(`${LAST_VIEWED_STORAGE_PREFIX}${campaignId}_${tab.id}`, String(timestamp));
  });
}

export default function CampaignTabs({ campaign }: CampaignTabsProps) {
  const [activeTab, setActiveTab] = useState<CampaignTabId>("updates");
  const [lastViewedTimestamps, setLastViewedTimestamps] = useState<Record<string, number>>(() => {
    const timestamps: Record<string, number> = {};
    TABS.forEach((tab) => {
      timestamps[tab.id] = getLastViewed(campaign.id, tab.id);
    });
    return timestamps;
  });

  useEffect(() => {
    const timestamps: Record<string, number> = {};
    TABS.forEach((tab) => {
      timestamps[tab.id] = getLastViewed(campaign.id, tab.id);
    });
    setLastViewedTimestamps(timestamps);
  }, [campaign.id]);

  const latestContentTimestamp = useMemo(() => {
    return Math.max(campaign.created_at, 0);
  }, [campaign.created_at]);

  const hasUnread = useCallback(
    (tabId: CampaignTabId) => {
      return latestContentTimestamp > lastViewedTimestamps[tabId];
    },
    [latestContentTimestamp, lastViewedTimestamps],
  );

  const handleTabChange = useCallback(
    (tabId: CampaignTabId) => {
      setActiveTab(tabId);
      const now = Date.now() / 1000;
      setAllLastViewed(campaign.id, now);
      setLastViewedTimestamps((_prev) => {
        const next: Record<string, number> = {};
        TABS.forEach((tab) => {
          next[tab.id] = now;
        });
        return next;
      });
    },
    [campaign.id],
  );

  const tabsWithCounts = useMemo(
    () =>
      TABS.map((tab) => ({
        ...tab,
        count: hasUnread(tab.id) ? 1 : undefined,
      })),
    [hasUnread],
  );

  return (
    <div className="space-y-6">
      <Tabs
        tabs={tabsWithCounts}
        activeId={activeTab}
        onChange={handleTabChange}
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

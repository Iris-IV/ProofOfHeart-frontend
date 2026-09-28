"use client";

import { useMemo } from "react";
import type { Campaign } from "../types";
import { useCampaign } from "./useCampaign";

/**
 * Hook for accessing campaign metadata fields only.
 * Separates metadata concerns from funding and rules logic.
 */
export interface UseCampaignMetadataResult {
  id: number | null;
  creator: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  coverImageUrl: string | null;
  location: { latitude: number; longitude: number } | null;
  socialLinks: Campaign["social_links"] | null;
  createdAt: number | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
}

export function useCampaignMetadata(campaignId: number): UseCampaignMetadataResult {
  const { campaign, isLoading, error, notFound } = useCampaign(campaignId);

  const metadata = useMemo(() => {
    if (!campaign) {
      return {
        id: null,
        creator: null,
        title: null,
        description: null,
        category: null,
        tags: [],
        coverImageUrl: null,
        location: null,
        socialLinks: null,
        createdAt: null,
      };
    }

    return {
      id: campaign.id,
      creator: campaign.creator,
      title: campaign.title,
      description: campaign.description,
      category: campaign.category,
      tags: campaign.tags ?? [],
      coverImageUrl: campaign.cover_image_url ?? null,
      location:
        campaign.latitude !== undefined && campaign.longitude !== undefined
          ? { latitude: campaign.latitude, longitude: campaign.longitude }
          : null,
      socialLinks: campaign.social_links ?? null,
      createdAt: campaign.created_at,
    };
  }, [campaign]);

  return {
    ...metadata,
    isLoading,
    error,
    notFound,
  };
}

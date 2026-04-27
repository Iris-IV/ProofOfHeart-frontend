'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCampaignUpdates, createCampaignUpdate } from '../lib/campaignUpdates';
import { CampaignUpdate } from '../types';

export interface UseCampaignUpdatesResult {
  updates: CampaignUpdate[];
  isLoading: boolean;
  error: string | null;
  createUpdate: (content: string, notify?: boolean) => Promise<void>;
  isCreating: boolean;
  refetch: () => void;
}

export function useCampaignUpdates(
  campaignId: number,
  creatorAddress?: string | null
): UseCampaignUpdatesResult {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<CampaignUpdate[], Error>({
    queryKey: ['campaignUpdates', campaignId],
    queryFn: () => getCampaignUpdates(campaignId),
    enabled: !!campaignId,
  });

  const { mutateAsync: createUpdateMutation, isPending: isCreating } = useMutation({
    mutationFn: async ({ content, notify }: { content: string; notify: boolean }) => {
      if (!creatorAddress) {
        throw new Error('Creator address not available');
      }
      return createCampaignUpdate(campaignId, content, creatorAddress, notify);
    },
    onSuccess: () => {
      // Invalidate and refetch updates after successful creation
      queryClient.invalidateQueries({ queryKey: ['campaignUpdates', campaignId] });
    },
  });

  const createUpdate = async (content: string, notify: boolean = false) => {
    await createUpdateMutation({ content, notify });
  };

  return {
    updates: data ?? [],
    isLoading,
    error: error?.message ?? null,
    createUpdate,
    isCreating,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['campaignUpdates', campaignId] });
    },
  };
}

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getCampaignComments, 
  createCampaignComment, 
  pinComment, 
  reportComment 
} from '../lib/campaignComments';
import { Comment } from '../types';

export interface UseCampaignCommentsResult {
  comments: Comment[];
  isLoading: boolean;
  error: string | null;
  createComment: (content: string, parentId?: string | null) => Promise<void>;
  isCreating: boolean;
  pinCommentMutation: (commentId: string, isPinned: boolean) => Promise<void>;
  isPinning: boolean;
  reportCommentMutation: (commentId: string) => Promise<void>;
  isReporting: boolean;
  refetch: () => void;
}

export function useCampaignComments(
  campaignId: number,
  userAddress?: string | null
): UseCampaignCommentsResult {
  const queryClient = useQueryClient();
  const queryKey = ['campaignComments', campaignId];

  const { data, isLoading, error } = useQuery<Comment[], Error>({
    queryKey,
    queryFn: () => getCampaignComments(campaignId),
    enabled: !!campaignId,
  });

  const { mutateAsync: createMutation, isPending: isCreating } = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId: string | null }) => {
      if (!userAddress) throw new Error('User address not available');
      return createCampaignComment(campaignId, content, userAddress, parentId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const { mutateAsync: pinMutation, isPending: isPinning } = useMutation({
    mutationFn: async ({ commentId, isPinned }: { commentId: string; isPinned: boolean }) => {
      return pinComment(campaignId, commentId, isPinned);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const { mutateAsync: reportMutation, isPending: isReporting } = useMutation({
    mutationFn: async (commentId: string) => {
      return reportComment(campaignId, commentId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    comments: data ?? [],
    isLoading,
    error: error?.message ?? null,
    createComment: async (content: string, parentId: string | null = null) => {
      await createMutation({ content, parentId });
    },
    isCreating,
    pinCommentMutation: async (commentId: string, isPinned: boolean) => {
      await pinMutation({ commentId, isPinned });
    },
    isPinning,
    reportCommentMutation: async (commentId: string) => {
      await reportMutation(commentId);
    },
    isReporting,
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  };
}

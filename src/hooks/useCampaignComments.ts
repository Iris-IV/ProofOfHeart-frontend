"use client";

import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCampaignComments,
  createCampaignComment,
  pinComment,
  reportComment,
} from "../lib/campaignComments";
import { Comment } from "../types";

export interface CommentsPage {
  items: Comment[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface UseCampaignCommentsResult {
  comments: Comment[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  page: number;
  loadNextPage: () => void;
  createComment: (content: string, parentId?: string | null) => Promise<void>;
  isCreating: boolean;
  pinCommentMutation: (commentId: string, isPinned: boolean) => Promise<void>;
  isPinning: boolean;
  reportCommentMutation: (commentId: string) => Promise<void>;
  isReporting: boolean;
  refetch: () => void;
}

const PAGE_SIZE = 20;

export function useCampaignComments(
  campaignId: number,
  userAddress?: string | null,
): UseCampaignCommentsResult {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const queryKey = ["campaignComments", campaignId, page];
  const allQueryKey = ["campaignComments", campaignId];

  const { data, isLoading, error } = useQuery<CommentsPage, Error>({
    queryKey,
    queryFn: () => getCampaignComments(campaignId, page, PAGE_SIZE),
    enabled: !!campaignId,
    placeholderData: (prev) => prev,
  });

  const { mutateAsync: createMutation, isPending: isCreating } = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId: string | null }) => {
      if (!userAddress) throw new Error("User address not available");
      return createCampaignComment(campaignId, content, userAddress, parentId);
    },
    onMutate: async ({ content, parentId }) => {
      // Optimistic insert
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CommentsPage>(queryKey);
      if (previous) {
        const optimistic: Comment = {
          id: `optimistic-${Date.now()}`,
          campaignId,
          content,
          authorAddress: userAddress ?? "",
          timestamp: Math.floor(Date.now() / 1000),
          parentId: parentId ?? null,
          signature: "",
          isPinned: false,
          isReported: false,
        };
        queryClient.setQueryData<CommentsPage>(queryKey, {
          ...previous,
          items: [...previous.items, optimistic],
          total: previous.total + 1,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: allQueryKey }),
  });

  const { mutateAsync: pinMutation, isPending: isPinning } = useMutation({
    mutationFn: async ({ commentId, isPinned }: { commentId: string; isPinned: boolean }) =>
      pinComment(campaignId, commentId, isPinned),
    onMutate: async ({ commentId, isPinned }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CommentsPage>(queryKey);
      if (previous) {
        queryClient.setQueryData<CommentsPage>(queryKey, {
          ...previous,
          items: previous.items.map((c) => (c.id === commentId ? { ...c, isPinned } : c)),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: allQueryKey }),
  });

  const { mutateAsync: reportMutation, isPending: isReporting } = useMutation({
    mutationFn: async (commentId: string) => reportComment(campaignId, commentId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CommentsPage>(queryKey);
      if (previous) {
        queryClient.setQueryData<CommentsPage>(queryKey, {
          ...previous,
          items: previous.items.filter((c) => c.id !== commentId),
          total: Math.max(0, previous.total - 1),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: allQueryKey }),
  });

  const loadNextPage = useCallback(() => {
    if (data?.hasMore) setPage((p) => p + 1);
  }, [data?.hasMore]);

  return {
    comments: data?.items ?? [],
    total: data?.total ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading,
    error: error?.message ?? null,
    page,
    loadNextPage,
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
    refetch: () => queryClient.invalidateQueries({ queryKey: allQueryKey }),
  };
}

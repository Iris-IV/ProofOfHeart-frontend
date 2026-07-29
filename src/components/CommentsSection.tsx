"use client";

import { Campaign } from "@/types";
import { useWallet } from "@/components/WalletContext";
import { useCampaignComments } from "@/hooks/useCampaignComments";
import CommentsList from "./CommentsList";
import CommentComposer from "./CommentComposer";

interface CommentsSectionProps {
  campaign: Campaign;
}

export default function CommentsSection({ campaign }: CommentsSectionProps) {
  const { publicKey: userAddress } = useWallet();
  const isCreator = userAddress ? userAddress === campaign.creator : false;

  const {
    comments,
    isLoading,
    error,
    createComment,
    isCreating,
    pinCommentMutation,
    reportCommentMutation,
  } = useCampaignComments(campaign.id, userAddress);

  const topLevelCommentsCount = comments.filter((c) => !c.parentId).length;

  return (
    <section
      className="space-y-6 mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800"
      aria-labelledby="comments-heading"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2
              id="comments-heading"
              className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2"
            >
              Q&A
              {topLevelCommentsCount > 0 && (
                <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 py-0.5 px-2 rounded-full text-sm font-medium">
                  {topLevelCommentsCount}
                </span>
              )}
            </h2>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              Live
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Connected wallets can ask the creator questions, and the creator can answer in-thread.
          </p>
        </div>
      </div>

      {/* Top-level Composer */}
      <CommentComposer
        userAddress={userAddress}
        onSubmit={createComment}
        isSubmitting={isCreating}
        placeholder="Ask the creator a question..."
      />

      {/* Comments List */}
      <CommentsList
        comments={comments}
        isLoading={isLoading}
        error={error}
        isCreator={isCreator}
        creatorAddress={campaign.creator}
        onReply={createComment}
        onPin={pinCommentMutation}
        onReport={reportCommentMutation}
      />
    </section>
  );
}

'use client';

import CommentComposer from './CommentComposer';
import CommentsList from './CommentsList';
import { useWallet } from '@/components/WalletContext';
import { useCampaignComments } from '@/hooks/useCampaignComments';
import { Campaign } from '@/types';

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

  const topLevelCommentsCount = comments.filter(c => !c.parentId).length;

  return (
    <section className="space-y-6 mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800" aria-labelledby="comments-heading">
      <div className="flex items-center justify-between">
        <h2 id="comments-heading" className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
          Comments / Q&A
          {topLevelCommentsCount > 0 && (
            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 py-0.5 px-2 rounded-full text-sm font-medium">
              {topLevelCommentsCount}
            </span>
          )}
        </h2>
      </div>

      {/* Top-level Composer */}
      <CommentComposer
        userAddress={userAddress}
        onSubmit={createComment}
        isSubmitting={isCreating}
      />

      {/* Comments List */}
      <CommentsList
        comments={comments}
        isLoading={isLoading}
        error={error}
        isCreator={isCreator}
        onReply={createComment}
        onPin={pinCommentMutation}
        onReport={reportCommentMutation}
      />
    </section>
  );
}

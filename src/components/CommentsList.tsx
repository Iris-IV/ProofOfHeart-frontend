import { useMemo } from 'react';
import { Comment } from '@/types';
import CommentItem from './CommentItem';
import Skeleton from './Skeleton';

interface CommentsListProps {
  comments: Comment[];
  isLoading: boolean;
  error: string | null;
  isCreator: boolean;
  onReply: (content: string, parentId: string) => Promise<void>;
  onPin: (commentId: string, isPinned: boolean) => Promise<void>;
  onReport: (commentId: string) => Promise<void>;
}

export default function CommentsList({
  comments,
  isLoading,
  error,
  isCreator,
  onReply,
  onPin,
  onReport,
}: CommentsListProps) {
  
  // Prepare threaded comments structure
  const { topLevelComments, repliesMap } = useMemo(() => {
    const topLevel: Comment[] = [];
    const repliesMap = new Map<string, Comment[]>();

    comments.forEach(comment => {
      if (!comment.parentId) {
        topLevel.push(comment);
      } else {
        const existingReplies = repliesMap.get(comment.parentId) || [];
        existingReplies.push(comment);
        repliesMap.set(comment.parentId, existingReplies);
      }
    });

    // Sort top level: Pinned first, then newest first
    topLevel.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.timestamp - a.timestamp;
    });

    // Sort replies: Oldest first (reading order)
    repliesMap.forEach((replies) => {
      replies.sort((a, b) => a.timestamp - b.timestamp);
    });

    return { topLevelComments: topLevel, repliesMap };
  }, [comments]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-5">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-16 h-3" />
              </div>
            </div>
            <Skeleton className="w-full h-4 mb-2" />
            <Skeleton className="w-3/4 h-4" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
        <p className="text-amber-700 dark:text-amber-400 text-sm">
          ⚠️ Failed to load comments. Please try again later.
        </p>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-8 text-center mt-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <svg className="w-8 h-8 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
          No questions yet
        </h3>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          Be the first to ask!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" role="feed" aria-label="Comments and Q&A">
      {topLevelComments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          replies={repliesMap.get(comment.id) || []}
          isCreator={isCreator}
          onReply={onReply}
          onPin={onPin}
          onReport={onReport}
        />
      ))}
    </div>
  );
}

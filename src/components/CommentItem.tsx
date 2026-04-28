import { useState, useEffect } from 'react';
import CommentComposer from './CommentComposer';
import { useWallet } from '@/components/WalletContext';
import { verifyCommentSignature } from '@/lib/campaignComments';
import { Comment } from '@/types';

interface CommentItemProps {
  comment: Comment;
  replies?: Comment[];
  isCreator: boolean;
  onReply: (content: string, parentId: string) => Promise<void>;
  onPin?: (commentId: string, isPinned: boolean) => Promise<void>;
  onReport: (commentId: string) => Promise<void>;
}

function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatAbsoluteTime(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }).format(new Date(timestamp * 1000));
}

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function CommentItem({
  comment,
  replies = [],
  isCreator,
  onReply,
  onPin,
  onReport,
}: CommentItemProps) {
  const { publicKey: userAddress } = useWallet();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  useEffect(() => {
    const verify = async () => {
      const result = await verifyCommentSignature(comment);
      setIsVerified(result);
    };
    verify();
  }, [comment]);

  const relativeTime = formatRelativeTime(comment.timestamp);
  const absoluteTime = formatAbsoluteTime(comment.timestamp);
  const shortenedAuthor = shortenAddress(comment.authorAddress);
  const isTopLevel = !comment.parentId;

  const handleReplySubmit = async (content: string) => {
    setIsReplying(true);
    try {
      await onReply(content, comment.id);
      setShowReplyForm(false);
    } finally {
      setIsReplying(false);
    }
  };

  return (
    <div className={`mt-4 ${!isTopLevel ? 'ml-2 sm:ml-8 border-l border-zinc-200 dark:border-zinc-800 pl-4 sm:pl-6' : ''}`}>
      <article
        className={`group bg-white dark:bg-zinc-800/80 rounded-2xl border ${
          comment.isPinned ? 'border-purple-300 dark:border-purple-500/50 shadow-xs' : 'border-zinc-200 dark:border-zinc-800'
        } p-4 sm:p-5 transition-all duration-300`}
        aria-label={`Comment from ${shortenedAuthor}`}
      >
        {comment.isPinned && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 mb-3">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Pinned by Creator
          </div>
        )}

        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-full bg-linear-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 text-sm font-bold shadow-inner">
              {comment.authorAddress.slice(1, 3).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50" title={comment.authorAddress}>
                  {shortenedAuthor}
                </span>
                {isVerified && (
                  <span className="inline-flex items-center text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 px-1.5 py-0.5 rounded-full font-bold" title="Verified Signature">
                    <svg className="w-2.5 h-2.5 mr-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                )}
                {comment.isReported && (
                  <span className="text-[10px] text-red-500 font-bold ml-1 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                    Reported
                  </span>
                )}
              </div>
              <time dateTime={new Date(comment.timestamp * 1000).toISOString()} className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 block" title={absoluteTime}>
                {relativeTime}
              </time>
            </div>
          </div>
          
          <div className="flex gap-2">
            {isTopLevel && isCreator && onPin && (
              <button
                onClick={() => onPin(comment.id, !comment.isPinned)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700"
                title={comment.isPinned ? "Unpin Comment" : "Pin Comment"}
                aria-label={comment.isPinned ? "Unpin Comment" : "Pin Comment"}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => onReport(comment.id)}
              disabled={comment.isReported}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-400 hover:text-red-500 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30"
              title="Report Comment"
              aria-label="Report Comment"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </button>
          </div>
        </div>

        <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap break-words text-sm ml-0 sm:ml-13 mb-3">
          {comment.isReported ? (
             <span className="italic text-zinc-500">This comment has been reported and is under review.</span>
          ) : (
             comment.content
          )}
        </div>

        <div className="ml-0 sm:ml-13 flex gap-4 text-xs font-medium border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
          <button
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Reply
          </button>
        </div>
      </article>

      {showReplyForm && (
        <CommentComposer
          userAddress={userAddress}
          isSubmitting={isReplying}
          onSubmit={handleReplySubmit}
          placeholder="Write a reply..."
          isReply={true}
          onCancel={() => setShowReplyForm(false)}
        />
      )}

      {replies.length > 0 && (
        <div className="space-y-1">
          {replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isCreator={isCreator}
              onReply={onReply}
              onReport={onReport}
            />
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';

interface CommentComposerProps {
  onSubmit: (content: string) => Promise<void>;
  isSubmitting: boolean;
  userAddress?: string | null;
  placeholder?: string;
  isReply?: boolean;
  onCancel?: () => void;
}

const MIN_CONTENT_LENGTH = 3;
const MAX_CONTENT_LENGTH = 1000;

export default function CommentComposer({
  onSubmit,
  isSubmitting,
  userAddress,
  placeholder = "Ask a question or leave a comment...",
  isReply = false,
  onCancel,
}: CommentComposerProps) {
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(isReply);
  const { showError, showSuccess } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userAddress) {
      showError('Please connect your wallet to post a comment.');
      return;
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length < MIN_CONTENT_LENGTH) {
      showError(`Comment must be at least ${MIN_CONTENT_LENGTH} characters.`);
      return;
    }

    try {
      await onSubmit(trimmedContent);
      setContent('');
      setIsExpanded(false);
      showSuccess(isReply ? 'Reply posted successfully!' : 'Comment posted successfully!');
      if (onCancel) onCancel();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : 'Failed to post comment. Please try again.'
      );
    }
  };

  const handleCancel = () => {
    setContent('');
    setIsExpanded(false);
    if (onCancel) onCancel();
  };

  const characterCount = content.length;
  const isOverLimit = characterCount > MAX_CONTENT_LENGTH;
  const isUnderMinLength = characterCount > 0 && characterCount < MIN_CONTENT_LENGTH;
  const canSubmit = !isSubmitting && !isOverLimit && characterCount >= MIN_CONTENT_LENGTH && !!userAddress;

  if (!userAddress) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 text-center">
        <p className="text-zinc-600 dark:text-zinc-400 mb-2">Connect your wallet to join the conversation.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 shadow-sm transition-all duration-300 ${
        isReply ? 'ml-0 sm:ml-12 mt-2' : ''
      }`}
    >
      {!isExpanded && !isReply ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="w-full text-left py-3 px-5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/50 dark:hover:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 transition-colors"
        >
          {placeholder}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 shrink-0 rounded-full bg-linear-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
              {userAddress?.slice(1, 3).toUpperCase() || '?'}
            </div>
            <div className="flex-1 space-y-2">
              <label htmlFor="comment-content" className="sr-only">
                Comment content
              </label>
              <textarea
                id="comment-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder}
                rows={Math.max(2, Math.min(5, content.split('\n').length))}
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm leading-relaxed resize-none"
                autoFocus={isExpanded || isReply}
              />
              <div className="flex justify-between items-center px-1">
                <span
                  className={`text-[10px] font-mono ${
                    isOverLimit ? 'text-red-500' : isUnderMinLength ? 'text-amber-500' : 'text-zinc-500'
                  }`}
                >
                  {characterCount} / {MAX_CONTENT_LENGTH}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-white text-sm font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    {isSubmitting ? 'Posting...' : isReply ? 'Reply' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

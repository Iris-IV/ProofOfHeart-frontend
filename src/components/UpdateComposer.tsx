'use client';

import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';

interface UpdateComposerProps {
  campaignId: number;
  creatorAddress: string;
  onSubmit: (content: string, notify: boolean) => Promise<void>;
  isSubmitting: boolean;
}

const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 2000;

/**
 * Composer component for campaign creators to post updates.
 * Only visible/enabled for the campaign creator.
 */
export default function UpdateComposer({
  campaignId,
  creatorAddress,
  onSubmit,
  isSubmitting,
}: UpdateComposerProps) {
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [notify, setNotify] = useState(true);
  const { showError, showSuccess } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedContent = content.trim();
    if (trimmedContent.length < MIN_CONTENT_LENGTH) {
      showError(`Update must be at least ${MIN_CONTENT_LENGTH} characters.`);
      return;
    }

    try {
      await onSubmit(trimmedContent, notify);
      setContent('');
      setIsExpanded(false);
      showSuccess('Update posted successfully!');
    } catch (error) {
      showError(
        error instanceof Error ? error.message : 'Failed to post update. Please try again.'
      );
    }
  };

  const handleCancel = () => {
    setContent('');
    setIsExpanded(false);
  };

  const characterCount = content.length;
  const isOverLimit = characterCount > MAX_CONTENT_LENGTH;
  const isUnderMinLength = characterCount > 0 && characterCount < MIN_CONTENT_LENGTH;
  const canSubmit = !isSubmitting && !isOverLimit && characterCount >= MIN_CONTENT_LENGTH;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm ring-1 ring-zinc-900/5 transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
            {creatorAddress.slice(1, 3).toUpperCase()}
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
            Post an Update
          </h3>
        </div>
        {!isExpanded && (
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
            Visible to all contributors
          </span>
        )}
      </div>

      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="w-full py-4 px-6 bg-linear-to-r from-purple-600/10 to-blue-600/10 hover:from-purple-600/20 hover:to-blue-600/20 text-purple-700 dark:text-purple-300 font-bold rounded-2xl border-2 border-dashed border-purple-200 dark:border-purple-800 transition-all duration-300 group"
        >
          <span className="group-hover:scale-110 inline-block transition-transform duration-200">✏️</span> Write an update to your supporters...
        </button>
      ) : (
        <div className="space-y-5">
          {/* Textarea */}
          <div className="relative">
            <label htmlFor={`update-content-${campaignId}`} className="sr-only">
              Update content
            </label>
            <textarea
              id={`update-content-${campaignId}`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share progress, milestones, or news..."
              rows={5}
              className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 focus:border-purple-500/50 transition-all text-sm leading-relaxed"
              autoFocus
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Notify toggle */}
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 transition-colors"></div>
                <span className="ml-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                  Email contributors
                </span>
              </label>
            </div>

            {/* Character count */}
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-mono tracking-tight ${
                  isOverLimit
                    ? 'text-red-500'
                    : isUnderMinLength
                    ? 'text-amber-500'
                    : 'text-zinc-500'
                }`}
              >
                {characterCount} / {MAX_CONTENT_LENGTH}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-3 px-6 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-zinc-200 disabled:to-zinc-300 dark:disabled:from-zinc-800 dark:disabled:to-zinc-900 disabled:text-zinc-500 dark:disabled:text-zinc-600 text-white font-bold rounded-xl transition-all duration-300 shadow-md hover:shadow-lg disabled:shadow-none text-sm active:scale-[0.98]"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Posting...
                </span>
              ) : 'Post Update'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="py-3 px-6 border-2 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 disabled:opacity-50 font-bold rounded-xl transition-all duration-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

'use client';

import { useEffect, useRef } from 'react';

interface CancelCampaignModalProps {
  campaignTitle: string;
  isOpen: boolean;
  isCancelling: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/**
 * CancelCampaignModal
 *
 * Confirmation dialog before calling cancel_campaign() on-chain.
 * Warns the creator that the action is irreversible and that all
 * contributors will be able to claim full refunds once cancelled.
 */
export default function CancelCampaignModal({
  campaignTitle,
  isOpen,
  isCancelling,
  onConfirm,
  onClose,
}: CancelCampaignModalProps) {
  const keepActiveRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Focus trap: cycle Tab/Shift+Tab between the two buttons
      if (e.key === 'Tab') {
        const first = keepActiveRef.current;
        const last = cancelRef.current;
        if (!first || !last) return;
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-focus the safe "Keep Active" button when modal opens
  useEffect(() => {
    if (isOpen) keepActiveRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    // Backdrop — clicking outside also closes
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-xl">
              ⚠️
            </div>
            <div>
              <h2
                id="cancel-modal-title"
                className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
              >
                Cancel Campaign?
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                This action cannot be undone. All contributors will be able to
                claim full refunds once the campaign is cancelled.
              </p>
            </div>
          </div>
        </div>

        {/* Campaign name */}
        <div className="mx-6 mb-5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
            Campaign
          </p>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {campaignTitle}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            ref={keepActiveRef}
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Keep Active
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={onConfirm}
            disabled={isCancelling}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {isCancelling ? (
              <>
                <span className="inline-block motion-safe:animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                Cancelling…
              </>
            ) : (
              'Cancel Campaign'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
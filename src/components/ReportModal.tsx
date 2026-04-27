'use client';

import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import {
  submitReport,
  REPORT_REASON_LABELS,
  type ReportReason,
} from '@/lib/campaignReports';

interface ReportModalProps {
  campaignId: number;
  campaignTitle: string;
  reporterAddress: string | null;
  onClose: () => void;
}

export default function ReportModal({
  campaignId,
  campaignTitle,
  reporterAddress,
  onClose,
}: ReportModalProps) {
  const { showSuccess, showError } = useToast();
  const [reason, setReason] = useState<ReportReason>('scam');
  const [notes, setNotes] = useState('');
  const [honeypot, setHoneypot] = useState(''); // bot trap
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return; // silently drop bot submissions

    setIsSubmitting(true);
    try {
      submitReport(campaignId, campaignTitle, reason, notes.trim(), reporterAddress);
      showSuccess('Report submitted. Our team will review it shortly.');
      onClose();
    } catch {
      showError('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <h2 id="report-modal-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Report Campaign
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Reporting: <span className="font-medium text-zinc-900 dark:text-zinc-100">{campaignTitle}</span>
          </p>

          {/* Reason */}
          <div>
            <label htmlFor="report-reason" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              required
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {(Object.entries(REPORT_REASON_LABELS) as [ReportReason, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="report-notes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Additional notes <span className="text-xs font-normal text-zinc-400">(optional)</span>
            </label>
            <textarea
              id="report-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Describe the issue..."
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <p className="text-xs text-zinc-400 mt-0.5 text-right">{notes.length}/500</p>
          </div>

          {/* Honeypot — hidden from real users */}
          <div className="hidden" aria-hidden="true">
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting && (
                <span className="inline-block motion-safe:animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              )}
              Submit Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

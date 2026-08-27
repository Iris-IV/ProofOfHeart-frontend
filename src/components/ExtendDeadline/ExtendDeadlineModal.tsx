'use client';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { extendCampaignDeadline } from '@/lib/contractClient';

interface Props {
  campaignId: number;
  currentDeadline: number;
  maxAdditionalDays?: number;
  onSuccess?: () => void;
  onClose: () => void;
}

export function ExtendDeadlineModal({ campaignId, currentDeadline, maxAdditionalDays = 30, onSuccess, onClose }: Props) {
  const [days, setDays] = useState(7);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newDeadline = currentDeadline + days * 24 * 60 * 60;
  const newDeadlineDate = new Date(newDeadline * 1000).toLocaleDateString();

  const handleExtend = async () => {
    if (days < 1 || days > maxAdditionalDays) {
      setError(`Days must be between 1 and ${maxAdditionalDays}`);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await extendCampaignDeadline(campaignId, days);
      onSuccess?.();
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Failed to extend deadline');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Extend Deadline">
      <div style={{ padding: 16 }}>
        <p style={{ marginBottom: 12, color: 'var(--muted)' }}>
          Extend campaign deadline by 1-{maxAdditionalDays} days. Only one extension allowed per campaign.
        </p>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
          Additional days
          <input
            type="number"
            min={1}
            max={maxAdditionalDays}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(maxAdditionalDays, Number(e.target.value) || 1)))}
            style={{ width: '100%', marginTop: 4, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}
          />
        </label>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
          New deadline: {newDeadlineDate}
        </p>
        {newDeadline > currentDeadline + 30 * 24 * 60 * 60 && (
          <p style={{ color: 'orange', fontSize: 12, marginBottom: 8 }}>Warning: hitting category duration cap</p>
        )}
        {error && <p style={{ color: 'red', fontSize: 13, marginBottom: 8 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={isSubmitting} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>Cancel</button>
          <button onClick={handleExtend} disabled={isSubmitting} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--primary)', color: 'white' }}>
            {isSubmitting ? 'Extending…' : 'Extend Deadline'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ExtendDeadlineModal;

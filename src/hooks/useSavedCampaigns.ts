import { useState, useEffect } from 'react';
import { useWallet } from '@/components/WalletContext';

const SAVED_CAMPAIGNS_KEY_PREFIX = 'poh_saved_campaigns_';

export function useSavedCampaigns() {
  const { publicKey } = useWallet();
  const [savedIds, setSavedIds] = useState<number[]>([]);

  useEffect(() => {
    if (!publicKey) {
      setSavedIds([]);
      return;
    }
    const key = `${SAVED_CAMPAIGNS_KEY_PREFIX}${publicKey}`;
    try {
      const data = localStorage.getItem(key);
      if (data) {
        setSavedIds(JSON.parse(data));
      } else {
        setSavedIds([]);
      }
    } catch {
      setSavedIds([]);
    }
  }, [publicKey]);

  const toggleSaved = (campaignId: number) => {
    if (!publicKey) return;
    
    setSavedIds((prev) => {
      const newIds = prev.includes(campaignId)
        ? prev.filter((id) => id !== campaignId)
        : [...prev, campaignId];
      
      const key = `${SAVED_CAMPAIGNS_KEY_PREFIX}${publicKey}`;
      try {
        localStorage.setItem(key, JSON.stringify(newIds));
      } catch (e) {
        console.error('Failed to save bookmarks', e);
      }
      return newIds;
    });
  };

  const isSaved = (campaignId: number) => savedIds.includes(campaignId);

  return { savedIds, toggleSaved, isSaved };
}

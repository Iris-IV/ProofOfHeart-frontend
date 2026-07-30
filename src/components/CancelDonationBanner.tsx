'use client';

import React, { useState, useEffect } from 'react';
import { PendingDonation } from '../hooks/useDonationGracePeriod';

interface CancelDonationBannerProps {
  pendingDonations: PendingDonation[];
  onCancel: (id: string) => void;
  onFinalize?: (id: string) => void;
}

export function CancelDonationBanner({
  pendingDonations,
  onCancel,
  onFinalize,
}: CancelDonationBannerProps) {
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    if (pendingDonations.length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [pendingDonations.length]);

  if (pendingDonations.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Pending Donations Grace Period"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4"
    >
      {pendingDonations.map((donation) => {
        const remainingSeconds = Math.max(
          0,
          Math.ceil((donation.expiresAt - Date.now()) / 1000)
        );

        return (
          <div
            key={donation.id}
            className="flex items-center justify-between gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-md shadow-xl text-amber-900 dark:text-amber-100 animate-in fade-in slide-in-from-bottom-2"
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <span>Grace Period Active</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-amber-500/20">
                  {remainingSeconds}s
                </span>
              </div>
              <p className="text-xs opacity-90">
                Donated {donation.amount} {donation.currency} to {donation.campaignTitle}
              </p>
            </div>

            <button
              onClick={() => onCancel(donation.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Cancel Donation
            </button>
          </div>
        );
      })}
    </div>
  );
}

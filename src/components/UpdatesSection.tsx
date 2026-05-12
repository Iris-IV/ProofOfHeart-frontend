'use client';

import { Campaign } from '@/types';
import { useWallet } from '@/components/WalletContext';
import { useCampaignUpdates } from '@/hooks/useCampaignUpdates';
import UpdatesList from '@/components/UpdatesList';
import UpdateComposer from '@/components/UpdateComposer';

interface UpdatesSectionProps {
  campaign: Campaign;
}

/**
 * Main updates section component that integrates the updates list and composer.
 * Shows the composer only to the campaign creator.
 */
export default function UpdatesSection({ campaign }: UpdatesSectionProps) {
  const { publicKey: userAddress } = useWallet();
  const isCreator = userAddress && userAddress === campaign.creator;

  const { updates, isLoading, error, createUpdate, isCreating } = useCampaignUpdates(
    campaign.id,
    isCreator ? userAddress : null
  );

  return (
    <section className="space-y-6" aria-labelledby="updates-heading">
      <div className="flex items-center justify-between">
        <h2
          id="updates-heading"
          className="text-xl font-bold text-zinc-900 dark:text-zinc-50"
        >
          Updates
        </h2>
        {updates.length > 0 && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {updates.length} {updates.length === 1 ? 'update' : 'updates'}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Composer - only shown to creator */}
        {isCreator && (
          <UpdateComposer
            campaignId={campaign.id}
            creatorAddress={userAddress}
            onSubmit={createUpdate}
            isSubmitting={isCreating}
          />
        )}

        {/* Updates list */}
        <UpdatesList updates={updates} isLoading={isLoading} error={error} />
      </div>
    </section>
  );
}

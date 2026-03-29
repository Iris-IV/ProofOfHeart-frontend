'use client';

import React, { useState } from 'react';
import { Campaign, stroopsToXlm } from '../types';
import { useWallet } from './WalletContext';
import { useAdmin } from '../hooks/useAdmin';
import { useContribution } from '../hooks/useContribution';
import { 
  withdrawFunds, 
  cancelCampaign, 
  depositRevenue, 
  claimRefund, 
  claimRevenue, 
  verifyCampaign 
} from '../lib/contractClient';
import { useToast } from './ToastProvider';
import { parseContractError } from '../utils/contractErrors';

interface CampaignActionsProps {
  campaign: Campaign;
  onActionSuccess?: () => void;
}

export default function CampaignActions({ campaign, onActionSuccess }: CampaignActionsProps) {
  const { publicKey, connectWallet, isWalletConnected } = useWallet();
  const { admin } = useAdmin();
  const { contribution } = useContribution(campaign.id, publicKey);
  const { showSuccess, showError } = useToast();
  const [isPending, setIsPending] = useState(false);

  const isCreator = publicKey === campaign.creator;
  const isAdmin = !!publicKey && publicKey === admin;
  const isContributor = contribution > BigInt(0);

  const handleAction = async (action: () => Promise<string>, successMsg: string) => {
    setIsPending(true);
    try {
      await action();
      showSuccess(successMsg);
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsPending(false);
    }
  };

  if (!isWalletConnected) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 text-center">
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">Connect your wallet to interact with this campaign.</p>
        <button
          onClick={connectWallet}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full transition-colors"
        >
          Connect Wallet to Contribute
        </button>
      </div>
    );
  }

  const raised = stroopsToXlm(campaign.amount_raised);
  const goal = stroopsToXlm(campaign.funding_goal);
  const isGoalMet = raised >= goal;
  const isExpired = Math.floor(Date.now() / 1000) > campaign.deadline;

  return (
    <div className="space-y-4">
      {/* Creator Actions */}
      {isCreator && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Creator Dashboard</h3>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleAction(() => withdrawFunds(campaign.id), 'Funds withdrawn successfully!')}
              disabled={isPending || !isGoalMet || campaign.funds_withdrawn || campaign.is_cancelled}
              title={!isGoalMet ? 'Goal not met yet' : campaign.funds_withdrawn ? 'Already withdrawn' : ''}
              className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
            >
              Withdraw Funds
            </button>
            <button
              onClick={() => handleAction(() => cancelCampaign(campaign.id), 'Campaign cancelled.')}
              disabled={isPending || !campaign.is_active || campaign.is_cancelled || campaign.funds_withdrawn}
              className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
            >
              Cancel Campaign
            </button>
            {campaign.has_revenue_sharing && (
              <button
                onClick={() => {
                  const amount = prompt('Enter amount of revenue to deposit (in stroops):');
                  if (amount) handleAction(() => depositRevenue(campaign.id, BigInt(amount)), 'Revenue deposited!');
                }}
                disabled={isPending || campaign.is_cancelled}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
              >
                Deposit Revenue
              </button>
            )}
          </div>
        </div>
      )}

      {/* Admin Actions */}
      {isAdmin && !campaign.is_verified && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 border-blue-200 dark:border-blue-900">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4 text-blue-600">Admin Panel</h3>
          <button
            onClick={() => handleAction(() => verifyCampaign(campaign.id), 'Campaign verified!')}
            disabled={isPending}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Verify Campaign
          </button>
        </div>
      )}

      {/* Contributor Actions */}
      {isContributor && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">Your Contribution</h3>
          <p className="text-2xl font-bold text-blue-600 mb-4">{stroopsToXlm(contribution)} XLM</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleAction(() => claimRefund(campaign.id, publicKey!), 'Refund claimed!')}
              disabled={isPending || (campaign.is_active && !isExpired)}
              title={campaign.is_active && !isExpired ? 'Cannot refund while active' : ''}
              className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
            >
              Claim Refund
            </button>
            {campaign.has_revenue_sharing && (
              <button
                onClick={() => handleAction(() => claimRevenue(campaign.id, publicKey!), 'Revenue claimed!')}
                disabled={isPending}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
              >
                Claim Revenue
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

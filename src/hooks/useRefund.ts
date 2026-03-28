'use client';

import { useState, useEffect, useCallback } from 'react';
import { Campaign } from '../types';
import { getContribution, claimRefund } from '../lib/contractClient';

export interface UseRefundResult {
  /** The contributor's refundable amount (XLM). 0 means no refund available. */
  contributionAmount: number;
  /** Whether the campaign qualifies for refunds (cancelled or failed). */
  isRefundEligible: boolean;
  /** True while fetching the contribution amount. */
  isLoadingContribution: boolean;
  /** True while the refund transaction is in progress. */
  isRefunding: boolean;
  /** True after a successful refund claim. */
  isRefunded: boolean;
  /** The refunded amount after a successful claim. */
  refundedAmount: number | null;
  /** Transaction hash of the successful refund. */
  transactionHash: string | null;
  /** Error message, if any. */
  error: string | null;
  /** Trigger the refund claim. */
  claimRefundAction: () => Promise<void>;
}

/**
 * Determines whether a campaign is eligible for refunds.
 *
 * A campaign is refund-eligible when:
 *  - It has been cancelled, OR
 *  - Its deadline has passed AND the funding goal was NOT reached
 */
function checkRefundEligibility(campaign: Campaign): boolean {
  if (campaign.isCancelled) return true;
  const now = Date.now() / 1000;
  return now > campaign.deadline && campaign.amountRaised < campaign.fundingGoal;
}

/**
 * Hook that manages the full refund-claim lifecycle for a single campaign.
 *
 * - Checks refund eligibility based on campaign state
 * - Fetches the user's contribution amount via `get_contribution`
 * - Handles the `claim_refund` contract call
 * - Exposes success/error state for the UI
 */
export function useRefund(
  campaign: Campaign | null,
  contributor: string | null
): UseRefundResult {
  const [contributionAmount, setContributionAmount] = useState(0);
  const [isLoadingContribution, setIsLoadingContribution] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [isRefunded, setIsRefunded] = useState(false);
  const [refundedAmount, setRefundedAmount] = useState<number | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isRefundEligible = campaign ? checkRefundEligibility(campaign) : false;

  // Fetch the contributor's contribution when the component mounts or inputs change.
  useEffect(() => {
    if (!campaign || !contributor || !isRefundEligible) {
      setContributionAmount(0);
      return;
    }

    let cancelled = false;

    setIsLoadingContribution(true);
    setError(null);

    getContribution(campaign.id, contributor)
      .then((amount) => {
        if (!cancelled) setContributionAmount(amount);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch contribution.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingContribution(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaign?.id, contributor, isRefundEligible]); // eslint-disable-line react-hooks/exhaustive-deps

  const claimRefundAction = useCallback(async () => {
    if (!campaign || !contributor) return;
    if (isRefunded) {
      setError('Already refunded');
      return;
    }
    if (contributionAmount === 0) {
      setError('No contribution to refund.');
      return;
    }

    setIsRefunding(true);
    setError(null);

    try {
      const result = await claimRefund(campaign.id, contributor);
      setIsRefunded(true);
      setRefundedAmount(result.refundedAmount);
      setTransactionHash(result.transactionHash);
      setContributionAmount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed. Please try again.');
    } finally {
      setIsRefunding(false);
    }
  }, [campaign, contributor, isRefunded, contributionAmount]);

  return {
    contributionAmount,
    isRefundEligible,
    isLoadingContribution,
    isRefunding,
    isRefunded,
    refundedAmount,
    transactionHash,
    error,
    claimRefundAction,
  };
}

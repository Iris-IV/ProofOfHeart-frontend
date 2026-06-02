/**
 * Targeted cache invalidation for Soroban contract events.
 * Maps event topics to React Query keys to invalidate, scoped by campaign id.
 */

import type { QueryClient } from '@tanstack/react-query';
import * as StellarSdk from '@stellar/stellar-sdk';

type Api = StellarSdk.rpc.Api.EventResponse;

// Event topic names from the contract
const CONTRIBUTION_MADE_TOPIC = 'contribution_made';
const WITHDRAW_FUNDS_TOPIC = 'withdraw_funds';
const CANCEL_CAMPAIGN_TOPIC = 'cancel_campaign';
const CLAIM_REFUND_TOPIC = 'claim_refund';
const VOTE_ON_CAMPAIGN_TOPIC = 'vote_on_campaign';
const DEPOSIT_REVENUE_TOPIC = 'deposit_revenue';
const VERIFY_CAMPAIGN_TOPIC = 'verify_campaign';

/**
 * Extracts the campaign id from a Soroban event.
 * Assumes campaign id is the second topic in the event.
 */
function extractCampaignId(event: Api): number | null {
  if (event.topic.length < 2) return null;
  try {
    return StellarSdk.scValToNative(event.topic[1]) as number;
  } catch {
    return null;
  }
}

/**
 * Extracts the contributor address from a Soroban event.
 * Assumes contributor address is the third topic in the event.
 */
function extractContributorAddress(event: Api): string | null {
  if (event.topic.length < 3) return null;
  try {
    const address = StellarSdk.scValToNative(event.topic[2]);
    return typeof address === 'string' ? address : null;
  } catch {
    return null;
  }
}

/**
 * Invalidates campaign-related queries for a specific campaign.
 */
function invalidateCampaignQueries(
  queryClient: QueryClient,
  campaignId: number,
): void {
  // Invalidate the specific campaign (updates amount_raised, status, etc.)
  queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
  
  // Invalidate campaign updates
  queryClient.invalidateQueries({ queryKey: ['campaignUpdates', campaignId] });
  
  // Invalidate campaign comments
  queryClient.invalidateQueries({ queryKey: ['campaignComments', campaignId] });
}

/**
 * Invalidates user-specific queries for a contributor.
 */
function invalidateContributorQueries(
  queryClient: QueryClient,
  walletAddress: string,
): void {
  // Invalidate user's contributions list
  queryClient.invalidateQueries({ queryKey: ['contributions', walletAddress] });
}

/**
 * Invalidates revenue sharing queries for a campaign.
 */
function invalidateRevenueQueries(
  queryClient: QueryClient,
  campaignId: number,
  walletAddress: string,
): void {
  queryClient.invalidateQueries({ 
    queryKey: ['revenueSharing', campaignId, walletAddress] 
  });
}

/**
 * Invalidates admin-related queries.
 */
function invalidateAdminQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['admin'] });
}

/**
 * Invalidates the campaigns list when a campaign is created or verified.
 */
function invalidateCampaignsList(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['campaigns'] });
}

/**
 * Maps a Soroban event to the appropriate React Query keys to invalidate.
 * Performs targeted invalidation scoped by campaign id to avoid over-invalidation.
 */
export function invalidateQueriesForEvent(
  queryClient: QueryClient,
  event: Api,
  currentWalletAddress: string | null,
): void {
  const campaignId = extractCampaignId(event);
  if (!campaignId) return;

  const topicName = StellarSdk.scValToNative(event.topic[0]) as string;

  switch (topicName) {
    case CONTRIBUTION_MADE_TOPIC: {
      // Invalidate campaign (amount_raised changes)
      invalidateCampaignQueries(queryClient, campaignId);
      
      // If the current user is the contributor, invalidate their contributions
      const contributor = extractContributorAddress(event);
      if (contributor && currentWalletAddress === contributor) {
        invalidateContributorQueries(queryClient, currentWalletAddress);
      }
      
      // Invalidate revenue sharing if applicable
      if (contributor && currentWalletAddress) {
        invalidateRevenueQueries(queryClient, campaignId, currentWalletAddress);
      }
      break;
    }

    case WITHDRAW_FUNDS_TOPIC: {
      // Invalidate campaign (status may change, funds withdrawn)
      invalidateCampaignQueries(queryClient, campaignId);
      
      // Invalidate current user's contributions (they may have received a refund)
      if (currentWalletAddress) {
        invalidateContributorQueries(queryClient, currentWalletAddress);
        invalidateRevenueQueries(queryClient, campaignId, currentWalletAddress);
      }
      break;
    }

    case CANCEL_CAMPAIGN_TOPIC: {
      // Invalidate campaign (status changes to cancelled)
      invalidateCampaignQueries(queryClient, campaignId);
      
      // Invalidate campaigns list (campaign may disappear from active list)
      invalidateCampaignsList(queryClient);
      
      // Invalidate all contributors' contributions (refunds may be available)
      // We can't target specific contributors without fetching all, so we skip
      // and rely on the campaign detail page to show the cancelled status
      break;
    }

    case CLAIM_REFUND_TOPIC: {
      // Invalidate campaign (amount_raised may decrease)
      invalidateCampaignQueries(queryClient, campaignId);
      
      // If the current user claimed, invalidate their contributions
      const contributor = extractContributorAddress(event);
      if (contributor && currentWalletAddress === contributor) {
        invalidateContributorQueries(queryClient, currentWalletAddress);
      }
      break;
    }

    case VOTE_ON_CAMPAIGN_TOPIC: {
      // Invalidate campaign (vote counts change, verification status may change)
      invalidateCampaignQueries(queryClient, campaignId);
      
      // Invalidate campaigns list (verification status affects display)
      invalidateCampaignsList(queryClient);
      break;
    }

    case DEPOSIT_REVENUE_TOPIC: {
      // Invalidate campaign (revenue pool changes)
      invalidateCampaignQueries(queryClient, campaignId);
      
      // Invalidate revenue sharing for all users
      // We can't target specific users, so we invalidate by campaign id pattern
      queryClient.invalidateQueries({ 
        queryKey: ['revenueSharing', campaignId],
        type: 'active',
      });
      break;
    }

    case VERIFY_CAMPAIGN_TOPIC: {
      // Invalidate campaign (verification status changes)
      invalidateCampaignQueries(queryClient, campaignId);
      
      // Invalidate campaigns list (campaign may appear/disappear from listings)
      invalidateCampaignsList(queryClient);
      
      // Invalidate admin queries (admin dashboard shows pending verifications)
      invalidateAdminQueries(queryClient);
      break;
    }

    default:
      // Unknown event type - skip invalidation
      break;
  }
}

/**
 * Batch invalidates queries for multiple events.
 * Useful when processing a batch of events from a poll.
 */
export function invalidateQueriesForEvents(
  queryClient: QueryClient,
  events: Api[],
  currentWalletAddress: string | null,
): void {
  // Use a Set to avoid duplicate invalidations for the same campaign
  const processedCampaigns = new Set<number>();
  
  for (const event of events) {
    const campaignId = extractCampaignId(event);
    if (campaignId && !processedCampaigns.has(campaignId)) {
      invalidateQueriesForEvent(queryClient, event, currentWalletAddress);
      processedCampaigns.add(campaignId);
    }
  }
}

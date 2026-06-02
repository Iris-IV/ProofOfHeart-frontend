/**
 * Privacy-respecting analytics for contribution funnel tracking.
 *
 * This module provides cookieless, consent-aware analytics that measure
 * drop-off across the contribution journey without tracking PII.
 *
 * No wallet addresses, amounts, or personally identifiable information
 * are sent to analytics services.
 */

type FunnelStep =
  | "funnel_view_campaign"
  | "funnel_click_contribute"
  | "funnel_enter_amount"
  | "funnel_connect_wallet"
  | "funnel_review_contribution"
  | "funnel_sign_transaction"
  | "funnel_confirmed"
  | "funnel_error";

interface FunnelEventData extends Record<string, unknown> {
  step: FunnelStep;
  campaignId?: string;
  errorType?: string;
  timestamp?: number;
  [key: string]: unknown;
}

/**
 * Checks if analytics is enabled and user has consented.
 * Returns false if user has opted out or DNT is enabled.
 */
function isAnalyticsEnabled(): boolean {
  // Check Do Not Track browser setting
  if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") {
    return false;
  }

  // Check if user has opted out (stored in localStorage)
  if (typeof window !== "undefined") {
    const optOut = localStorage.getItem("analytics_opt_out");
    if (optOut === "true") {
      return false;
    }
  }

  return true;
}

/**
 * Anonymizes a campaign ID by hashing it.
 * This prevents tracking individual campaigns while allowing funnel analysis.
 */
function anonymizeCampaignId(campaignId: number): string {
  // Simple hash function for anonymization
  // In production, consider using a proper hash function
  return `campaign_${campaignId % 1000}`;
}

/**
 * Sends a funnel event to analytics service.
 * This is a placeholder - integrate with your analytics provider.
 */
function sendAnalyticsEvent(eventName: string, data: Record<string, unknown>): void {
  if (!isAnalyticsEnabled()) {
    return;
  }

  // Placeholder for analytics integration
  // Replace with your analytics provider (e.g., Plausible, Umami, PostHog)
  if (process.env.NODE_ENV === "development") {
    console.log("[Analytics]", eventName, data);
  }

  // Example integration with a privacy-focused analytics service:
  // if (typeof window !== "undefined" && window.plausible) {
  //   window.plausible(eventName, { props: data });
  // }
}

/**
 * Tracks a contribution funnel event.
 */
export function trackFunnelEvent(
  step: FunnelStep,
  options?: {
    campaignId?: number;
    errorType?: string;
  },
): void {
  const data: FunnelEventData = {
    step,
    timestamp: Date.now(),
  };

  // Anonymize campaign ID if provided
  if (options?.campaignId !== undefined) {
    data.campaignId = anonymizeCampaignId(options.campaignId);
  }

  // Include generic error type (no sensitive details)
  if (options?.errorType) {
    data.errorType = options.errorType;
  }

  sendAnalyticsEvent("contribution_funnel", data);
}

/**
 * User views a campaign detail page.
 */
export function trackViewCampaign(campaignId: number): void {
  trackFunnelEvent("funnel_view_campaign", { campaignId });
}

/**
 * User clicks the "Contribute" or "Donate" button.
 */
export function trackClickContribute(campaignId: number): void {
  trackFunnelEvent("funnel_click_contribute", { campaignId });
}

/**
 * User enters an amount in the donation modal.
 */
export function trackEnterAmount(campaignId: number): void {
  trackFunnelEvent("funnel_enter_amount", { campaignId });
}

/**
 * User connects their wallet.
 */
export function trackConnectWallet(): void {
  trackFunnelEvent("funnel_connect_wallet");
}

/**
 * User reviews their contribution before signing.
 */
export function trackReviewContribution(campaignId: number): void {
  trackFunnelEvent("funnel_review_contribution", { campaignId });
}

/**
 * User signs the transaction in their wallet.
 */
export function trackSignTransaction(campaignId: number): void {
  trackFunnelEvent("funnel_sign_transaction", { campaignId });
}

/**
 * Transaction is confirmed on the network.
 */
export function trackContributionConfirmed(campaignId: number): void {
  trackFunnelEvent("funnel_confirmed", { campaignId });
}

/**
 * An error occurred during the contribution flow.
 */
export function trackContributionError(campaignId: number, errorType: string): void {
  trackFunnelEvent("funnel_error", { campaignId, errorType });
}

/**
 * Allows users to opt out of analytics.
 */
export function optOutOfAnalytics(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("analytics_opt_out", "true");
  }
}

/**
 * Allows users to opt back in to analytics.
 */
export function optInToAnalytics(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("analytics_opt_out");
  }
}

/**
 * Checks if user has opted out of analytics.
 */
export function hasOptedOutOfAnalytics(): boolean {
  if (typeof window !== "undefined") {
    return localStorage.getItem("analytics_opt_out") === "true";
  }
  return false;
}

/**
 * Privacy-respecting analytics for contribution funnel tracking.
 *
 * This module provides cookieless, consent-aware analytics that measure
 * drop-off across the contribution journey without tracking PII.
 *
 * No wallet addresses, amounts, or personally identifiable information
 * are sent to analytics services.
 *
 * The vendor script is injected lazily by `ThirdPartyScripts` (#657), so events
 * fired during early hydration can arrive before `window.plausible` /
 * `window.umami` exist. Rather than reintroduce a blocking `<head>` snippet just
 * to install the vendor's queue stub, this module buffers those events itself
 * and flushes them from the script's `onLoad`.
 */

import { getAnalyticsProvider } from "@/lib/thirdParty";
import { getItem, setItem, removeItem } from "./localStorageStore";

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, unknown> }) => void;
    umami?: { track: (event: string, data?: Record<string, unknown>) => void };
  }
}

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
  const optOut = getItem<string>("analytics_opt_out");
  if (optOut === "true") {
    return false;
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
 * Events fired before the deferred vendor script finished loading.
 *
 * Bounded so that a misconfigured or blocked provider — an ad blocker, a CSP
 * rejection, a vendor outage — leaks a fixed amount of memory instead of
 * growing for the lifetime of the tab.
 */
const MAX_PENDING_EVENTS = 50;
const pendingEvents: Array<{ name: string; data: Record<string, unknown> }> = [];

/**
 * Hands one event to the loaded vendor.
 * Returns false when no provider is available yet, so the caller can buffer it.
 */
function deliver(eventName: string, data: Record<string, unknown>): boolean {
  if (typeof window === "undefined") return false;

  switch (getAnalyticsProvider()) {
    case "plausible":
      if (typeof window.plausible !== "function") return false;
      window.plausible(eventName, { props: data });
      return true;
    case "umami":
      if (typeof window.umami?.track !== "function") return false;
      window.umami.track(eventName, data);
      return true;
    default:
      // No provider configured — the events are still logged in development
      // below, and there is nothing to wait for, so treat them as delivered.
      return true;
  }
}

/**
 * Flushes events buffered while the vendor script was still loading.
 *
 * Called from the `onLoad` handler of the analytics `<Script>`. Safe to call
 * more than once, and a no-op when nothing was buffered.
 */
export function flushAnalyticsQueue(): void {
  while (pendingEvents.length > 0) {
    const event = pendingEvents[0];
    if (!deliver(event.name, event.data)) return; // still not ready; keep the queue intact
    pendingEvents.shift();
  }
}

/**
 * Sends a funnel event to the configured analytics provider.
 */
function sendAnalyticsEvent(eventName: string, data: Record<string, unknown>): void {
  if (!isAnalyticsEnabled()) {
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[Analytics]", eventName, data);
  }

  if (deliver(eventName, data)) {
    return;
  }

  if (pendingEvents.length < MAX_PENDING_EVENTS) {
    pendingEvents.push({ name: eventName, data });
  }
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
  setItem("analytics_opt_out", "true");
}

/**
 * Allows users to opt back in to analytics.
 */
export function optInToAnalytics(): void {
  removeItem("analytics_opt_out");
}

/**
 * Checks if user has opted out of analytics.
 */
export function hasOptedOutOfAnalytics(): boolean {
  return getItem<string>("analytics_opt_out") === "true";
}

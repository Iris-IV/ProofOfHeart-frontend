"use client";

import { getWalletTransactions, type WalletTransactionLogEntry } from "./transactionLog";
import { normalizeAddress } from "./stellar";
import { getArray, setArray } from "./localStorageStore";
import { AppNotificationSchema, NotificationFeedResponseSchema, parseWithOrNull } from "./schemas";
import type { NotificationPreferences } from "./preferences";

// ARIA live region for screen reader announcements
let ariaLiveRegion: HTMLElement | null = null;

function getAriaLiveRegion(): HTMLElement {
  if (!ariaLiveRegion && typeof document !== "undefined") {
    ariaLiveRegion = document.getElementById("notification-announcer") || createAriaLiveRegion();
  }
  return ariaLiveRegion!;
}

function createAriaLiveRegion(): HTMLElement {
  const region = document.createElement("div");
  region.id = "notification-announcer";
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  region.className = "sr-only";
  region.style.position = "absolute";
  region.style.left = "-10000px";
  region.style.width = "1px";
  region.style.height = "1px";
  region.style.overflow = "hidden";
  document.body.appendChild(region);
  return region;
}

export function announceNotification(message: string): void {
  try {
    const region = getAriaLiveRegion();
    region.textContent = message;
  } catch {
    // Graceful fallback for SSR or missing DOM
    console.log("[a11y announcement]", message);
  }
}

export type NotificationEventType =
  | "contribution_confirmed"
  | "campaign_funded"
  | "campaign_cancelled"
  | "refund_available"
  | "revenue_deposited"
  | "revenue_claimed"
  | "new_update"
  | "campaign_verified";

export interface AppNotification {
  id: string;
  type: NotificationEventType;
  campaignId: number;
  campaignTitle: string;
  message: string;
  href: string;
  timestamp: number;
  read: boolean;
}

/** Toast style used when a notification arrives while the app is open (#1347). */
export const NOTIFICATION_TOAST_TYPES: Record<
  NotificationEventType,
  "success" | "info" | "warning" | "error"
> = {
  contribution_confirmed: "success",
  campaign_funded: "success",
  campaign_cancelled: "warning",
  refund_available: "info",
  revenue_deposited: "success",
  revenue_claimed: "success",
  new_update: "info",
  campaign_verified: "success",
};

/** Event types with their own on/off switch in Notification Preferences. */
const PREFERENCE_FOR_EVENT: Partial<
  Record<
    NotificationEventType,
    keyof Pick<
      NotificationPreferences,
      "contributions" | "verified" | "refundAvailable" | "revenueDeposited"
    >
  >
> = {
  contribution_confirmed: "contributions",
  campaign_verified: "verified",
  refund_available: "refundAvailable",
  revenue_deposited: "revenueDeposited",
};

/**
 * Whether a newly arrived notification should pop up as a toast: only for
 * users on "instant" in-app delivery, and never for an event they turned off.
 */
export function shouldToastNotification(
  notification: Pick<AppNotification, "type">,
  prefs: Pick<NotificationPreferences, "frequency" | "channels"> & Partial<NotificationPreferences>,
): boolean {
  if (prefs.frequency !== "instant" || !prefs.channels.includes("inApp")) return false;
  const pref = PREFERENCE_FOR_EVENT[notification.type];
  return pref ? prefs[pref] !== false : true;
}

/**
 * Unread notifications in `next` that were not in `previous`, newest first.
 * `previous === null` means this is the first load, which returns nothing so
 * the existing backlog doesn't arrive as a burst of toasts.
 */
export function getNewlyArrivedNotifications(
  previous: readonly AppNotification[] | null,
  next: readonly AppNotification[],
): AppNotification[] {
  if (previous === null) return [];
  const seen = new Set(previous.map((notification) => notification.id));
  return next
    .filter((notification) => !notification.read && !seen.has(notification.id))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export interface NotificationFeedResponse {
  notifications: AppNotification[];
}

const REMOTE_FEED_ENDPOINT = "/api/notifications";
const READ_STATE_KEY_PREFIX = "proof_of_heart_notifications_read_v1";

function readNotificationIds(walletAddress: string): string[] {
  const key = `${READ_STATE_KEY_PREFIX}:${normalizeAddress(walletAddress)}`;
  const ids = getArray<string>(key);
  return ids.filter((value): value is string => typeof value === "string");
}

function writeNotificationIds(walletAddress: string, ids: string[]): void {
  const key = `${READ_STATE_KEY_PREFIX}:${normalizeAddress(walletAddress)}`;
  setArray(key, ids, 250);
}

function walletActionToNotification(
  action: WalletTransactionLogEntry["action"],
  entry: WalletTransactionLogEntry,
): Pick<AppNotification, "type" | "message" | "href"> | null {
  const campaignHref = `/causes/${entry.campaignId}`;

  switch (action) {
    case "contribute":
      return {
        type: "contribution_confirmed",
        message: `Contribution confirmed on-chain for campaign #${entry.campaignId}.`,
        href: campaignHref,
      };
    case "deposit_revenue":
      return {
        type: "revenue_deposited",
        message: `Revenue deposited on-chain for campaign #${entry.campaignId}.`,
        href: campaignHref,
      };
    case "claim_refund":
      return {
        type: "refund_available",
        message: `Refund transaction confirmed for campaign #${entry.campaignId}.`,
        href: campaignHref,
      };
    case "claim_revenue":
      return {
        type: "revenue_claimed",
        message: `Revenue claim confirmed for campaign #${entry.campaignId}.`,
        href: campaignHref,
      };
    case "vote":
      return {
        type: "new_update",
        message: `Vote recorded on-chain for campaign #${entry.campaignId}.`,
        href: campaignHref,
      };
    default:
      return null;
  }
}

async function fetchRemoteNotifications(
  walletAddress: string,
  signal?: AbortSignal,
): Promise<AppNotification[] | null> {
  try {
    const url = new URL(REMOTE_FEED_ENDPOINT, window.location.origin);
    url.searchParams.set("walletAddress", walletAddress);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      return null;
    }

    const raw: unknown = await response.json();

    // Accept either `{ notifications: [...] }` or a bare array.
    let notifications: AppNotification[];
    if (Array.isArray(raw)) {
      notifications = raw
        .map((item) => parseWithOrNull(AppNotificationSchema, "AppNotificationSchema", item))
        .filter((item): item is AppNotification => item !== null);
    } else {
      const feed = parseWithOrNull(
        NotificationFeedResponseSchema,
        "NotificationFeedResponseSchema",
        raw,
      );
      if (!feed) return null;
      notifications = feed.notifications;
    }

    return notifications
      .filter((item) => Boolean(item.id && item.href))
      .map((item) => ({
        ...item,
        read: Boolean(item.read),
      }));
  } catch {
    return null;
  }
}

function deriveLocalNotifications(walletAddress: string): AppNotification[] {
  const entries = getWalletTransactions(walletAddress);
  return entries
    .map((entry) => {
      const mapped = walletActionToNotification(entry.action, entry);
      if (!mapped) return null;

      return {
        id: `tx-${entry.txHash}`,
        campaignId: entry.campaignId,
        campaignTitle: `Campaign #${entry.campaignId}`,
        timestamp: entry.timestamp,
        read: false,
        ...mapped,
      } satisfies AppNotification;
    })
    .filter(Boolean) as AppNotification[];
}

export async function fetchNotifications(
  walletAddress: string,
  signal?: AbortSignal,
): Promise<AppNotification[]> {
  const normalizedWallet = normalizeAddress(walletAddress);
  if (!normalizedWallet) return [];

  const remoteNotifications = await fetchRemoteNotifications(normalizedWallet, signal);
  const notifications = remoteNotifications ?? deriveLocalNotifications(normalizedWallet);
  const readIds = readNotificationIds(normalizedWallet);

  return notifications
    .map((notification) => ({
      ...notification,
      read: readIds.includes(notification.id) || notification.read,
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function markNotificationRead(
  walletAddress: string,
  notificationId: string,
): Promise<void> {
  const normalizedWallet = normalizeAddress(walletAddress);
  if (!normalizedWallet) return;

  const readIds = new Set(readNotificationIds(normalizedWallet));
  readIds.add(notificationId);
  writeNotificationIds(normalizedWallet, Array.from(readIds));

  try {
    await fetch(REMOTE_FEED_ENDPOINT, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        walletAddress: normalizedWallet,
        notificationId,
      }),
    });
  } catch {
    // Local read state is still persisted above.
  }
}

export async function markAllNotificationsRead(
  walletAddress: string,
  notifications: AppNotification[],
): Promise<void> {
  const normalizedWallet = normalizeAddress(walletAddress);
  if (!normalizedWallet) return;

  const readIds = notifications.map((notification) => notification.id);
  writeNotificationIds(normalizedWallet, readIds);

  try {
    await fetch(REMOTE_FEED_ENDPOINT, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        walletAddress: normalizedWallet,
        notificationIds: readIds,
      }),
    });
  } catch {
    // Local read state is still persisted above.
  }
}

export function enrichNotificationsWithReadState(
  walletAddress: string,
  notifications: AppNotification[],
): AppNotification[] {
  if (!normalizeAddress(walletAddress)) return notifications;
  const readIds = new Set(readNotificationIds(walletAddress));
  return notifications.map((notification) => ({
    ...notification,
    read: readIds.has(notification.id) || notification.read,
  }));
}

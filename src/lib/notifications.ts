"use client";

import { getWalletTransactions, type WalletTransactionLogEntry } from "./transactionLog";
import { normalizeAddress } from "./stellar";

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

export interface NotificationFeedResponse {
  notifications: AppNotification[];
}

const REMOTE_FEED_ENDPOINT = "/api/notifications";
const READ_STATE_KEY_PREFIX = "proof_of_heart_notifications_read_v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readNotificationIds(walletAddress: string): string[] {
  if (!canUseStorage()) return [];
  try {
    const key = `${READ_STATE_KEY_PREFIX}:${normalizeAddress(walletAddress)}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function writeNotificationIds(walletAddress: string, ids: string[]): void {
  if (!canUseStorage()) return;
  try {
    const key = `${READ_STATE_KEY_PREFIX}:${normalizeAddress(walletAddress)}`;
    window.localStorage.setItem(key, JSON.stringify(ids.slice(-250)));
  } catch {
    // Ignore localStorage write failures.
  }
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

async function fetchRemoteNotifications(walletAddress: string): Promise<AppNotification[] | null> {
  try {
    const url = new URL(REMOTE_FEED_ENDPOINT, window.location.origin);
    url.searchParams.set("walletAddress", walletAddress);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      return null;
    }

    const payload = (await response.json()) as NotificationFeedResponse | AppNotification[];
    const notifications = Array.isArray(payload) ? payload : payload.notifications;
    return notifications
      .filter((item): item is AppNotification => Boolean(item && item.id && item.href))
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

export async function fetchNotifications(walletAddress: string): Promise<AppNotification[]> {
  const normalizedWallet = normalizeAddress(walletAddress);
  if (!normalizedWallet) return [];

  const remoteNotifications = await fetchRemoteNotifications(normalizedWallet);
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

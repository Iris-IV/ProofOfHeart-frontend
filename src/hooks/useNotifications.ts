'use client';

import { useCallback, useEffect, useState } from 'react';

export type NotificationEventType =
  | 'contribution_confirmed'
  | 'campaign_funded'
  | 'campaign_cancelled'
  | 'refund_available'
  | 'revenue_deposited'
  | 'new_update';

export interface AppNotification {
  id: string;
  type: NotificationEventType;
  campaignId: number;
  campaignTitle: string;
  message: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = 'proof_of_heart_notifications_v1';
const POLL_INTERVAL_MS = 30_000;

function canUseStorage(): boolean {
  return typeof window !== 'undefined';
}

function readAll(): AppNotification[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(notifications: AppNotification[]): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    // ignore
  }
}

/** Push a new notification — called from other parts of the app after actions. */
export function pushNotification(
  notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>,
): void {
  const all = readAll();
  all.unshift({
    ...notification,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    read: false,
  });
  // Keep at most 50 notifications
  writeAll(all.slice(0, 50));
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const refresh = useCallback(() => {
    setNotifications(readAll());
  }, []);

  // Initial load + polling
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    const updated = readAll().map((n) => ({ ...n, read: true }));
    writeAll(updated);
    setNotifications(updated);
  }, []);

  const markRead = useCallback((id: string) => {
    const updated = readAll().map((n) => (n.id === id ? { ...n, read: true } : n));
    writeAll(updated);
    setNotifications(updated);
  }, []);

  return { notifications, unreadCount, markAllRead, markRead, refresh };
}

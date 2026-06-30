"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AppNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

const POLL_INTERVAL_MS = 30_000;

export function useNotifications(walletAddress: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const refresh = useCallback(async () => {
    if (!walletAddress) {
      setNotifications([]);
      return;
    }

    const nextNotifications = await fetchNotifications(walletAddress);
    setNotifications(nextNotifications);
  }, [walletAddress]);

  useEffect(() => {
    void refresh();
    if (!walletAddress) return;

    const id = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [refresh, walletAddress]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const markAllRead = useCallback(async () => {
    if (!walletAddress) return;
    await markAllNotificationsRead(walletAddress, notifications);
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }, [notifications, walletAddress]);

  const markRead = useCallback(
    async (id: string) => {
      if (!walletAddress) return;
      await markNotificationRead(walletAddress, id);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification,
        ),
      );
    },
    [walletAddress],
  );

  return { notifications, unreadCount, markAllRead, markRead, refresh };
}

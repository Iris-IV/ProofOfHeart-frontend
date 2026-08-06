"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AppNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

const POLL_INTERVAL_MS = 30_000;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function useNotifications(walletAddress: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!walletAddress) {
        setNotifications([]);
        return;
      }

      try {
        const nextNotifications = await fetchNotifications(walletAddress, { signal });
        if (signal?.aborted) return;
        setNotifications(nextNotifications);
      } catch (error) {
        // Inflight fetch aborted on unmount / remount — do not touch state.
        if (signal?.aborted || isAbortError(error)) return;
      }
    },
    [walletAddress],
  );

  useEffect(() => {
    const controller = new AbortController();

    void refresh(controller.signal);
    if (!walletAddress) {
      return () => controller.abort();
    }

    const id = setInterval(() => {
      void refresh(controller.signal);
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(id);
      controller.abort();
    };
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

  const refreshManual = useCallback(async () => {
    await refresh();
  }, [refresh]);

  return { notifications, unreadCount, markAllRead, markRead, refresh: refreshManual };
}

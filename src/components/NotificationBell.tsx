"use client";

import { Link } from "@/i18n/routing";
import { useEffect, useRef, useState } from "react";
import { Bell, ExternalLink } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useWallet } from "@/components/WalletContext";
import type { AppNotification } from "@/lib/notifications";

const EVENT_ICONS: Record<AppNotification["type"], string> = {
  contribution_confirmed: "💜",
  campaign_funded: "🎉",
  campaign_cancelled: "❌",
  refund_available: "↩",
  revenue_deposited: "💰",
  revenue_claimed: "💸",
  new_update: "📢",
  campaign_verified: "✅",
};

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const { publicKey } = useWallet();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications(publicKey);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleOpen = () => {
    setOpen((value) => !value);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-zinc-950 hover:bg-black/5 dark:border-white/15 dark:bg-zinc-800 dark:text-white dark:hover:bg-white/10 transition-colors shadow-sm"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
            {notifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                {publicKey ? "No notifications yet" : "Connect your wallet to see notifications"}
              </li>
            ) : (
              notifications.map((n) => (
                <li
                  key={n.id}
                  className={`px-4 py-3 flex items-start gap-3 transition-colors ${
                    !n.read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                  }`}
                >
                  <span className="text-lg shrink-0 mt-0.5">{EVENT_ICONS[n.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-snug">
                      {n.message}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                      {timeAgo(n.timestamp)}
                    </p>
                    <Link
                      href={n.href}
                      onClick={() => void markRead(n.id)}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View details
                      <ExternalLink size={12} aria-hidden="true" />
                    </Link>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => void markRead(n.id)}
                      className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-blue-500"
                      aria-label={`Mark notification for campaign ${n.campaignId} as read`}
                    />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

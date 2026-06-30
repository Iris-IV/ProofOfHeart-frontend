"use client";

import { useState, useMemo } from "react";
import { Settings2 } from "lucide-react";
import { useWallet } from "./WalletContext";
import {
  type NotificationPreferences,
  getNotificationPreferences,
  setNotificationPreferences,
} from "@/lib/preferences";

const PREF_LABELS: Record<keyof NotificationPreferences, string> = {
  contributions: "My Contributions",
  verified: "Campaign Verification",
  refundAvailable: "Refund Available",
  revenueDeposited: "Revenue Deposited",
};

const ALL_EVENTS: (keyof NotificationPreferences)[] = [
  "contributions",
  "verified",
  "refundAvailable",
  "revenueDeposited",
];

export default function NotificationSettings() {
  const { publicKey } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const storedPrefs = useMemo(
    () => (publicKey ? getNotificationPreferences(publicKey) : null),
    [publicKey],
  );
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences | null>(null);

  const prefs = localPrefs ?? storedPrefs;

  if (!publicKey || !prefs) return null;

  const toggle = (key: keyof NotificationPreferences) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setLocalPrefs(next);
    setNotificationPreferences(publicKey, next);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-zinc-950 hover:bg-black/5 dark:border-white/15 dark:bg-zinc-800 dark:text-white dark:hover:bg-white/10 transition-colors shadow-sm"
        aria-label="Notification settings"
      >
        <Settings2 size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Notification Preferences
            </h3>
          </div>
          <div className="p-2">
            {ALL_EVENTS.map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
              >
                <span>{PREF_LABELS[key]}</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    onChange={() => toggle(key)}
                    className="peer sr-only"
                  />
                  <div className="h-5 w-9 rounded-full bg-zinc-300 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-blue-500 peer-checked:after:translate-x-4 dark:bg-zinc-600" />
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Settings2 } from "lucide-react";
import { useWallet } from "./WalletContext";
import { useTranslations } from "next-intl";
import {
  type NotificationPreferences,
  type NotificationFrequency,
  type NotificationChannel,
  getNotificationPreferences,
  setNotificationPreferences,
} from "@/lib/preferences";

const TOGGLE_EVENTS: (keyof Pick<
  NotificationPreferences,
  "contributions" | "verified" | "refundAvailable" | "revenueDeposited"
>)[] = ["contributions", "verified", "refundAvailable", "revenueDeposited"];

const FREQUENCY_OPTIONS: { value: NotificationFrequency; label: string }[] = [
  { value: "instant", label: "Instant" },
  { value: "daily", label: "Daily Digest" },
  { value: "weekly", label: "Weekly" },
];

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: "inApp", label: "In-App" },
  { value: "email", label: "Email" },
];

export default function NotificationSettings() {
  const t = useTranslations("Notifications");
  const { publicKey } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const storedPrefs = useMemo(
    () => (publicKey ? getNotificationPreferences(publicKey) : null),
    [publicKey],
  );

  const PREF_LABELS: Record<string, string> = useMemo(
    () => ({
      contributions: t("prefContributions"),
      verified: t("prefVerified"),
      refundAvailable: t("prefRefundAvailable"),
      revenueDeposited: t("prefRevenueDeposited"),
    }),
    [t],
  );
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences | null>(null);

  const prefs = localPrefs ?? storedPrefs;

  if (!publicKey || !prefs) return null;

  const update = (next: NotificationPreferences) => {
    setLocalPrefs(next);
    setNotificationPreferences(publicKey, next);
  };

  const toggleEvent = (key: keyof Pick<NotificationPreferences, "contributions" | "verified" | "refundAvailable" | "revenueDeposited">) => {
    update({ ...prefs, [key]: !prefs[key] });
  };

  const setFrequency = (frequency: NotificationFrequency) => {
    update({ ...prefs, frequency });
  };

  const toggleChannel = (channel: NotificationChannel) => {
    const channels = prefs.channels.includes(channel)
      ? prefs.channels.filter((c) => c !== channel)
      : [...prefs.channels, channel];
    update({ ...prefs, channels });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-zinc-950 hover:bg-black/5 dark:border-white/15 dark:bg-zinc-800 dark:text-white dark:hover:bg-white/10 transition-colors shadow-sm"
        aria-label={t("settingsAriaLabel")}
      >
        <Settings2 size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {t("settingsTitle")}
            </h3>
          </div>
          <div className="p-2">
            {TOGGLE_EVENTS.map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
              >
                <span>{PREF_LABELS[key]}</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    onChange={() => toggleEvent(key)}
                    className="peer sr-only"
                  />
                  <div className="h-5 w-9 rounded-full bg-zinc-300 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-blue-500 peer-checked:after:translate-x-4 dark:bg-zinc-600" />
                </div>
              </label>
            ))}
          </div>

          <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Frequency</p>
            <div className="flex gap-1">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFrequency(opt.value)}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    prefs.frequency === opt.value
                      ? "bg-blue-500 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Channels</p>
            <div className="flex gap-2">
              {CHANNEL_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300"
                >
                  <input
                    type="checkbox"
                    checked={prefs.channels.includes(opt.value)}
                    onChange={() => toggleChannel(opt.value)}
                    className="size-3.5 rounded border-zinc-300 text-blue-500 focus:ring-blue-500"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

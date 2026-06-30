"use client";

import { useMemo, useState } from "react";

interface InstallFreighterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
}

function detectBrowser(): { name: string; supported: boolean } {
  if (typeof navigator === "undefined") return { name: "Unknown", supported: false };
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("chrome") && !ua.includes("edg")) return { name: "Chrome", supported: true };
  if (ua.includes("edg")) return { name: "Edge", supported: true };
  if (ua.includes("firefox")) return { name: "Firefox", supported: true };
  if (ua.includes("safari")) return { name: "Safari", supported: false };
  return { name: "Other", supported: false };
}

export default function InstallFreighterModal({
  isOpen,
  onClose,
  onRetry,
}: InstallFreighterModalProps) {
  const browser = useMemo(
    () => (isOpen ? detectBrowser() : { name: "", supported: false }),
    [isOpen],
  );
  const [checking, setChecking] = useState(false);

  const handleRetry = async () => {
    setChecking(true);
    await new Promise((r) => setTimeout(r, 500));
    onRetry();
    setChecking(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl dark:bg-amber-900/40">
            💳
          </div>

          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Freighter Wallet Required
          </h2>

          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            This app requires the Freighter browser extension to interact with the Stellar network.
          </p>

          {!browser.supported && browser.name && (
            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              Freighter does not support <strong>{browser.name}</strong>. Please use Chrome, Edge,
              or Firefox.
            </div>
          )}

          <div className="mt-6 space-y-3">
            <a
              href="https://www.freighter.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Install Freighter
            </a>

            <button
              onClick={handleRetry}
              disabled={checking}
              className="w-full rounded-full border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {checking ? "Checking..." : "I installed it — check again"}
            </button>

            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-xs text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

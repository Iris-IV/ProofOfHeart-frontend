"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const onInstalled = () => {
      setInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  if (!isInstallable || installed) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 shadow-lg dark:border-red-800 dark:bg-gray-900">
      <span className="text-lg">&#9829;</span>
      <div className="text-sm">
        <p className="font-medium text-gray-900 dark:text-gray-100">Install ProofOfHeart</p>
        <p className="text-gray-500 dark:text-gray-400">Add to home screen for the best experience</p>
      </div>
      <button
        onClick={handleInstall}
        className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
      >
        Install
      </button>
      <button
        onClick={() => setIsInstallable(false)}
        className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}

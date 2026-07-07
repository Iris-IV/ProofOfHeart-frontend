"use client";

import { useEffect, useRef, useState } from "react";
import { WALLET_ADAPTERS, type WalletAdapter, type WalletId } from "@/lib/walletAdapters";

interface WalletSelectionModalProps {
  isOpen: boolean;
  onSelect: (adapterId: WalletId) => void;
  onClose: () => void;
}

/**
 * Modal that lets the user pick which Stellar wallet extension to connect.
 *
 * Each option shows the wallet's icon, name, and an availability badge
 * (available / not installed). Selecting an unavailable wallet opens its
 * install page in a new tab.
 */
export default function WalletSelectionModal({
  isOpen,
  onSelect,
  onClose,
}: WalletSelectionModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Track which wallets are currently installed
  const [availability, setAvailability] = useState<Record<WalletId, boolean | null>>(
    () =>
      Object.fromEntries(WALLET_ADAPTERS.map((a) => [a.id, null])) as Record<
        WalletId,
        boolean | null
      >,
  );

  // Probe availability whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    WALLET_ADAPTERS.forEach(async (adapter) => {
      const available = await adapter.isAvailable();
      setAvailability((prev) => ({ ...prev, [adapter.id]: available }));
    });

    return () => {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  // ESC to close + focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (adapter: WalletAdapter) => {
    const isAvailable = availability[adapter.id];
    if (isAvailable === false && adapter.installUrl) {
      window.open(adapter.installUrl, "_blank", "noopener,noreferrer");
      return;
    }
    onSelect(adapter.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2
            id="wallet-modal-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Connect Wallet
          </h2>
          <button
            onClick={onClose}
            aria-label="Close wallet selection"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Wallet list */}
        <ul className="px-4 py-3 space-y-2">
          {WALLET_ADAPTERS.map((adapter) => {
            const isAvailable = availability[adapter.id];
            const isProbing = isAvailable === null;

            return (
              <li key={adapter.id}>
                <button
                  onClick={() => handleSelect(adapter)}
                  aria-label={
                    isAvailable === false
                      ? `Install ${adapter.name}`
                      : `Connect with ${adapter.name}`
                  }
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-150 group text-left"
                >
                  {/* Icon */}
                  <span
                    className="text-2xl w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors"
                    aria-hidden="true"
                  >
                    {adapter.icon}
                  </span>

                  {/* Name + status */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
                      {adapter.name}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {isProbing
                        ? "Checking..."
                        : isAvailable
                          ? "Ready to connect"
                          : "Not installed"}
                    </p>
                  </div>

                  {/* Badge */}
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                      isProbing
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                        : isAvailable
                          ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {isProbing ? "…" : isAvailable ? "Installed" : "Install →"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Footer note */}
        <p className="px-6 pb-4 text-xs text-center text-zinc-400 dark:text-zinc-500">
          New to Stellar wallets?{" "}
          <a
            href="https://developers.stellar.org/docs/wallets"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            Learn more
          </a>
        </p>
      </div>
    </div>
  );
}

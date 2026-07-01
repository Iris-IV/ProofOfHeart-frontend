"use client";
import React from "react";
import { ALL_ADAPTERS, WALLET_DESCRIPTORS } from "@/lib/walletAdapters";
import type { WalletId } from "@/lib/walletAdapters";

interface WalletSelectModalProps {
  isOpen: boolean;
  isLoading: boolean;
  /** ID of the wallet currently being connected (shows spinner) */
  connectingId: WalletId | null;
  onSelect: (id: WalletId) => void;
  onClose: () => void;
}

/**
 * Modal that lists all registered wallet adapters and lets the user pick one.
 *
 * If the chosen wallet is not installed, an install link is shown instead of
 * triggering a connection attempt.
 */
const WalletSelectModal: React.FC<WalletSelectModalProps> = ({
  isOpen,
  isLoading,
  connectingId,
  onSelect,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-select-title"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2
            id="wallet-select-title"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            Connect Wallet
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close wallet selector"
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Wallet options */}
        <ul className="space-y-3">
          {ALL_ADAPTERS.map((adapter) => {
            const descriptor = WALLET_DESCRIPTORS[adapter.id];
            const available = adapter.isAvailable();
            const isConnecting = connectingId === adapter.id;

            return (
              <li key={adapter.id}>
                {available ? (
                  <button
                    onClick={() => onSelect(adapter.id)}
                    disabled={isLoading}
                    aria-busy={isConnecting}
                    className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition-colors hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-gray-700"
                  >
                    <span className="text-2xl" aria-hidden="true">
                      {descriptor.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{descriptor.name}</p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {descriptor.description}
                      </p>
                    </div>
                    {isConnecting && (
                      <svg
                        className="h-5 w-5 animate-spin text-blue-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                    )}
                  </button>
                ) : (
                  /* Extension not detected — show install link */
                  <a
                    href={descriptor.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center gap-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-left opacity-70 transition-opacity hover:opacity-100 dark:border-gray-600 dark:bg-gray-800"
                    aria-label={`Install ${descriptor.name} wallet`}
                  >
                    <span className="text-2xl" aria-hidden="true">
                      {descriptor.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{descriptor.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Not installed — click to install
                      </p>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 flex-shrink-0 text-gray-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                  </a>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
          By connecting you agree to our terms of service.
        </p>
      </div>
    </div>
  );
};

export default WalletSelectModal;

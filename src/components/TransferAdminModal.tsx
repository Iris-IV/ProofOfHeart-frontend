"use client";

import { useEffect, useRef, useState } from "react";

interface TransferAdminModalProps {
  newAdminAddress: string;
  isOpen: boolean;
  isTransferring: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  typeConfirmPlaceholder: string;
  cancelLabel: string;
  confirmButtonLabel: string;
}

/**
 * TransferAdminModal
 *
 * Confirmation dialog before calling update_admin() on-chain.
 * Shows the target address in monospace and requires typing
 * "CONFIRM" (or localized equivalent) into a gated input.
 */
export default function TransferAdminModal({
  newAdminAddress,
  isOpen,
  isTransferring,
  onConfirm,
  onClose,
  title,
  body,
  confirmLabel,
  typeConfirmPlaceholder,
  cancelLabel,
  confirmButtonLabel,
}: TransferAdminModalProps) {
  const keepActiveRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmInput, setConfirmInput] = useState("");

  const requiredWord = "CONFIRM";
  const canConfirm = confirmInput.trim() === requiredWord;

  // Reset input when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setConfirmInput("");
    }
  }, [isOpen]);

  // ESC to close, focus trap
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const first = keepActiveRef.current;
        const last = confirmRef.current;
        if (!first || !last) return;
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-admin-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="transfer-admin-title"
          className="text-xl font-bold text-zinc-900 dark:text-zinc-50"
        >
          {title}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1">
            New Admin Address
          </p>
          <p className="font-mono text-xs text-zinc-900 dark:text-zinc-100 break-all">
            {newAdminAddress}
          </p>
        </div>
        <div>
          <label
            htmlFor="confirm-input"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
          >
            {confirmLabel}
          </label>
          <input
            id="confirm-input"
            ref={inputRef}
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={typeConfirmPlaceholder}
            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="flex gap-3">
          <button
            ref={keepActiveRef}
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={!canConfirm || isTransferring}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isTransferring ? "Transferring..." : confirmButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

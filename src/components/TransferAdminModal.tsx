"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "./ui/Modal";
import { isValidStellarPublicKey } from "@/utils/validators";

interface TransferAdminModalProps {
  newAdminAddress?: string;
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
  const t = useTranslations("Admin");
  const keepActiveRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmInput, setConfirmInput] = useState("");

  const requiredWord = t("requiredWord");
  // When an address is supplied, it must be a well-formed Stellar public key
  // before submit is allowed. This catches invalid input client-side instead of
  // failing only after a Freighter signature prompt and a wasted transaction.
  const isAddressValid = !newAdminAddress || isValidStellarPublicKey(newAdminAddress);
  const canConfirm = confirmInput.trim() === requiredWord && isAddressValid;

  // Reset input when modal opens
  useEffect(() => {
    if (isOpen) {
      setConfirmInput("");
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="transfer-admin-title"
      initialFocusRef={inputRef}
      className="p-6 space-y-4"
    >
      <h2 id="transfer-admin-title" className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
      {newAdminAddress ? (
        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1">
            {t("newAdminAddress")}
          </p>
          <p className="font-mono text-xs text-zinc-900 dark:text-zinc-100 break-all">
            {newAdminAddress}
          </p>
        </div>
      ) : null}
      {newAdminAddress && !isAddressValid ? (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {t("invalidAddress")}
        </p>
      ) : null}
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
          type="button"
          ref={keepActiveRef}
          onClick={onClose}
          className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          ref={confirmRef}
          onClick={onConfirm}
          disabled={!canConfirm || isTransferring}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isTransferring ? t("transferring") : confirmButtonLabel}
        </button>
      </div>
    </Modal>
  );
}

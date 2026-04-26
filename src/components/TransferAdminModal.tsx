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

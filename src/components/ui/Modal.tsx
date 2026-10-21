"use client";

import React, { useEffect, useRef, memo } from "react";
import { cn } from "./cn";

const FOCUSABLE_SELECTOR =
  'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

const FORM_FIELD_SELECTOR =
  'input:not([disabled]):not([tabindex="-1"]):not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"])';

export interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  className?: string;
  overlayClassName?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  role?: "dialog" | "alertdialog";
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * "dialog" (default) is a centred card. "drawer" is a glass panel that rises
   * from the bottom on phones and slides in from the right from `sm` up (#1349).
   */
  variant?: "dialog" | "drawer";
}

const OVERLAY_VARIANTS = {
  dialog: "items-center justify-center p-4",
  drawer: "items-end justify-center p-0 sm:items-stretch sm:justify-end",
} as const;

const PANEL_VARIANTS = {
  dialog:
    "w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden",
  drawer:
    "glass-surface ui-slide-up w-full max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))] sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:rounded-l-3xl",
} as const;

/**
 * Shared Modal Shell Component
 *
 * Provides an accessible dialog backdrop, focus trap, Escape key handling,
 * body scroll locking, focus restoration, and standard dialog attributes.
 *
 * Initial focus prefers the first form field (input/select/textarea) so
 * keyboard users can fill donation and other forms without tab order gaps.
 */
function Modal({
  isOpen = true,
  onClose,
  children,
  ariaLabelledBy,
  ariaDescribedBy,
  className,
  overlayClassName,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  role = "dialog",
  initialFocusRef,
  variant = "dialog",
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Lock body scroll and restore focus on unmount
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Set initial focus to provided ref, first form field, first focusable, or modal
    const timer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (modalRef.current) {
        const formField = modalRef.current.querySelector<HTMLElement>(FORM_FIELD_SELECTOR);
        if (formField) {
          formField.focus();
          return;
        }
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, initialFocusRef]);

  // Focus trap & Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape) {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const scope = modalRef.current;
        const focusable = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || !scope.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !scope.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm",
        OVERLAY_VARIANTS[variant],
        overlayClassName,
      )}
      onClick={handleOverlayClick}
      data-testid="modal-overlay"
    >
      <div
        ref={modalRef}
        role={role}
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        data-variant={variant}
        className={cn(PANEL_VARIANTS[variant], "focus:outline-none", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default memo(Modal);

"use client";

import React, { useEffect, useRef, memo } from "react";
import {
  computeNextFocusTrapTarget,
  getFocusableModalElements,
  resolveInitialModalFocusTarget,
} from "@/lib/preferences";
import { cn } from "./cn";

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
    "ui-pop-in w-full max-w-md rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl backdrop-saturate-150 shadow-2xl border border-zinc-200/80 dark:border-zinc-700/80 overflow-hidden",
  drawer:
    "ui-slide-up border border-white/60 bg-white/90 shadow-2xl backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-zinc-900/90 w-full max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))] sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:rounded-l-3xl",
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
      const target = resolveInitialModalFocusTarget(
        modalRef.current,
        initialFocusRef?.current ?? null,
      );
      target?.focus();
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
        const focusable = getFocusableModalElements(scope);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const nextTarget = computeNextFocusTrapTarget(
          focusable,
          document.activeElement,
          e.shiftKey,
          scope,
        );
        if (nextTarget) {
          e.preventDefault();
          nextTarget.focus();
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
        "modal-backdrop-enter fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm",
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

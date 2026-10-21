"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
  type CSSProperties,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = "error" | "success" | "warning" | "info";

/** A link rendered inline after the message (e.g. "View on Explorer"). */
export interface ToastAction {
  label: string;
  href: string;
}

/** A button rendered on the toast, e.g. "Retry" for a failed transaction (#1347). */
export interface ToastButtonAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Auto-dismiss delay in ms. Defaults per type, see TOAST_DURATIONS. */
  duration?: number;
  /** Clicking it runs the action and dismisses the toast. */
  action?: ToastButtonAction;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: ReactNode;
  duration: number;
  action?: ToastButtonAction;
}

interface ToastContextValue {
  showToast: (message: ReactNode, type?: ToastType, options?: ToastOptions) => void;
  showError: (message: ReactNode, options?: ToastOptions) => void;
  showSuccess: (message: ReactNode, options?: ToastOptions) => void;
  showWarning: (message: ReactNode, options?: ToastOptions) => void;
  showInfo: (message: ReactNode, options?: ToastOptions) => void;
  /** Use this when the toast needs a clickable link (e.g. "View on Explorer"). */
  showToastWithAction: (message: string, action: ToastAction, type?: ToastType) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Individual toast
// ---------------------------------------------------------------------------

const ICONS: Record<ToastType, string> = {
  error: "✕",
  success: "✓",
  warning: "⚠",
  info: "ℹ",
};

/** Gradient accent stripe and countdown bar colour per type. */
const ACCENTS: Record<ToastType, string> = {
  error: "from-rose-500 to-red-600",
  success: "from-emerald-400 to-green-600",
  warning: "from-amber-400 to-orange-500",
  info: "from-sky-400 to-blue-600",
};

const ICON_STYLES: Record<ToastType, string> = {
  error: "bg-red-500/15 text-red-600 ring-red-500/30 dark:text-red-300",
  success: "bg-green-500/15 text-green-600 ring-green-500/30 dark:text-green-300",
  warning: "bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-300",
  info: "bg-sky-500/15 text-sky-600 ring-sky-500/30 dark:text-sky-300",
};

const ACTION_STYLES: Record<ToastType, string> = {
  error: "text-red-700 ring-red-500/40 hover:bg-red-500/10 dark:text-red-200",
  success: "text-green-700 ring-green-500/40 hover:bg-green-500/10 dark:text-green-200",
  warning: "text-amber-700 ring-amber-500/40 hover:bg-amber-500/10 dark:text-amber-200",
  info: "text-sky-700 ring-sky-500/40 hover:bg-sky-500/10 dark:text-sky-200",
};

const LINK_STYLES: Record<ToastType, string> = {
  error: "text-red-700 dark:text-red-300 underline hover:text-red-900 dark:hover:text-red-100",
  success:
    "text-green-700 dark:text-green-300 underline hover:text-green-900 dark:hover:text-green-100",
  warning:
    "text-yellow-700 dark:text-yellow-300 underline hover:text-yellow-900 dark:hover:text-yellow-100",
  info: "text-blue-700 dark:text-blue-300 underline hover:text-blue-900 dark:hover:text-blue-100",
};

/** Default auto-dismiss delays. Errors stay longer so there is time to read and retry. */
export const TOAST_DURATIONS: Record<ToastType, number> = {
  success: 5000,
  info: 5000,
  warning: 6000,
  error: 8000,
};

/** Exit animation length before the toast is removed from the DOM. */
const EXIT_MS = 120;

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Time left on the auto-dismiss timer, kept across pauses.
  const remainingRef = useRef(toast.duration);
  const startedAtRef = useRef(0);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);

  const handleDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLeaving(true);
    // Wait for the exit transition before removing from the DOM.
    setTimeout(() => onDismiss(toast.id), EXIT_MS);
  }, [onDismiss, toast.id]);

  // Auto-dismiss, paused while the toast is hovered or has focus (WCAG 2.2.1),
  // so an action like Retry can't disappear under the pointer.
  useEffect(() => {
    if (paused || leaving) return;
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(handleDismiss, remainingRef.current);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedAtRef.current),
      );
    };
  }, [paused, leaving, handleDismiss]);

  const syncPaused = () => setPaused(hoveredRef.current || focusedRef.current);

  const isError = toast.type === "error";

  return (
    <div
      role={isError ? "alert" : undefined}
      data-type={toast.type}
      data-paused={paused}
      onPointerEnter={() => {
        hoveredRef.current = true;
        syncPaused();
      }}
      onPointerLeave={() => {
        hoveredRef.current = false;
        syncPaused();
      }}
      onFocus={() => {
        focusedRef.current = true;
        syncPaused();
      }}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        focusedRef.current = false;
        syncPaused();
      }}
      className={`
        glass-surface ui-slide-up relative w-full max-w-sm overflow-hidden rounded-xl
        text-zinc-900 transition-[opacity,transform] duration-(--duration-snappy) ease-out
        dark:text-zinc-50 sm:w-[22rem]
        ${leaving ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"}
      `}
    >
      {/* Accent stripe */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${ACCENTS[toast.type]}`}
      />

      <div className="flex items-start gap-3 py-3 pl-5 pr-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ${ICON_STYLES[toast.type]}`}
        >
          {ICONS[toast.type]}
        </span>

        <div className="min-w-0 flex-1">
          {/* Message — rendered as JSX, never as raw HTML */}
          <p className="text-sm leading-snug break-words">{toast.message}</p>

          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                handleDismiss();
              }}
              className={`mt-2 inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold ring-1 transition-colors duration-(--duration-snappy) focus-ring ${ACTION_STYLES[toast.type]}`}
            >
              {toast.action.label}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none opacity-60 transition-opacity duration-(--duration-snappy) hover:opacity-100 focus-ring"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {/* Countdown: shrinks over the toast's lifetime, pauses with the timer. */}
      <span
        aria-hidden="true"
        data-testid="toast-countdown"
        data-paused={paused}
        className={`ui-countdown absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r ${ACCENTS[toast.type]}`}
        style={{ "--toast-duration": `${toast.duration}ms` } as CSSProperties}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  const hasError = toasts.some((t) => t.type === "error");

  return (
    <div
      aria-live={hasError ? "assertive" : "polite"}
      aria-atomic="true"
      aria-relevant="additions"
      aria-label="Notifications"
      role="status"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)_+_1.25rem)] left-1/2 -translate-x-1/2 w-full px-4 sm:w-auto sm:px-0 sm:left-auto sm:right-5 sm:translate-x-0 z-50 flex flex-col gap-2 items-center sm:items-end pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: ReactNode, type: ToastType = "info", options: ToastOptions = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const toast: ToastItem = {
        id,
        type,
        message,
        duration: options.duration ?? TOAST_DURATIONS[type],
        action: options.action,
      };
      setToasts((prev) => {
        const next = [...prev, toast];
        // Keep only the newest MAX_TOASTS
        return next.slice(-MAX_TOASTS);
      });
    },
    [],
  );

  const showToastWithAction = useCallback(
    (message: string, action: ToastAction, type: ToastType = "info") => {
      // The "View on Explorer" link case — rendered safely as JSX, no innerHTML.
      const content = (
        <span>
          {message}{" "}
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            // type-safe inline class lookup — no dynamic HTML
            className={LINK_STYLES[type]}
          >
            {action.label}
          </a>
        </span>
      );
      showToast(content, type);
    },
    [showToast],
  );

  const showError = useCallback(
    (msg: ReactNode, options?: ToastOptions) => showToast(msg, "error", options),
    [showToast],
  );
  const showSuccess = useCallback(
    (msg: ReactNode, options?: ToastOptions) => showToast(msg, "success", options),
    [showToast],
  );
  const showWarning = useCallback(
    (msg: ReactNode, options?: ToastOptions) => showToast(msg, "warning", options),
    [showToast],
  );
  const showInfo = useCallback(
    (msg: ReactNode, options?: ToastOptions) => showToast(msg, "info", options),
    [showToast],
  );

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showError,
        showSuccess,
        showWarning,
        showInfo,
        showToastWithAction,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

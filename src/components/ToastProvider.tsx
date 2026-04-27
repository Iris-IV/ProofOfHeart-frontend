"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = "error" | "success" | "warning" | "info";

export interface ToastAction {
  label: string;
  href: string;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: ReactNode;
}

interface ToastContextValue {
  showToast: (message: ReactNode, type?: ToastType) => void;
  showError: (message: ReactNode) => void;
  showSuccess: (message: ReactNode) => void;
  showWarning: (message: ReactNode) => void;
  showInfo: (message: ReactNode) => void;
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

const STYLES: Record<ToastType, string> = {
  error:
    "bg-red-50 dark:bg-red-900/80 border-red-300 dark:border-red-700 text-red-900 dark:text-red-100",
  success:
    "bg-green-50 dark:bg-green-900/80 border-green-300 dark:border-green-700 text-green-900 dark:text-green-100",
  warning:
    "bg-yellow-50 dark:bg-yellow-900/80 border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100",
  info: "bg-blue-50 dark:bg-blue-900/80 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100",
};

const ICON_STYLES: Record<ToastType, string> = {
  error: "bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-300",
  success: "bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300",
  warning: "bg-yellow-100 dark:bg-yellow-800 text-yellow-600 dark:text-yellow-300",
  info: "bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300",
};

const LINK_STYLES: Record<ToastType, string> = {
  error: "text-red-700 dark:text-red-300 underline hover:text-red-900 dark:hover:text-red-100",
  success:
    "text-green-700 dark:text-green-300 underline hover:text-green-900 dark:hover:text-green-100",
  warning:
    "text-yellow-700 dark:text-yellow-300 underline hover:text-yellow-900 dark:hover:text-yellow-100",
  info: "text-blue-700 dark:text-blue-300 underline hover:text-blue-900 dark:hover:text-blue-100",
};

const AUTO_DISMISS_MS = 5000;

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate in
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    timerRef.current = setTimeout(() => handleDismiss(), AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    // Wait for the CSS transition before removing from DOM
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const isError = toast.type === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={`
        flex items-start gap-3 w-full max-w-sm rounded-xl border px-4 py-3 shadow-lg
        transition-all duration-300 ease-in-out
        ${STYLES[toast.type]}
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
      `}
    >
      {/* Icon */}
      <span
        className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${ICON_STYLES[toast.type]}`}
      >
        {ICONS[toast.type]}
      </span>

      {/* Message — rendered as JSX, never as raw HTML */}
      <p className="flex-1 text-sm leading-snug">{toast.message}</p>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none mt-0.5"
      >
        <span aria-hidden="true">×</span>
      </button>
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

  return (
    <div
      aria-label="Notifications"
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

  const showToast = useCallback((message: ReactNode, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => {
      const next = [...prev, { id, type, message }];
      // Keep only the newest MAX_TOASTS
      return next.slice(-MAX_TOASTS);
    });
  }, []);

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

  const showError = useCallback((msg: ReactNode) => showToast(msg, "error"), [showToast]);
  const showSuccess = useCallback((msg: ReactNode) => showToast(msg, "success"), [showToast]);
  const showWarning = useCallback((msg: ReactNode) => showToast(msg, "warning"), [showToast]);
  const showInfo = useCallback((msg: ReactNode) => showToast(msg, "info"), [showToast]);

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

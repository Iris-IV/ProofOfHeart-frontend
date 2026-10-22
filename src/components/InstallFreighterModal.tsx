"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Wallet, X } from "lucide-react";
import Modal from "./ui/Modal";

interface InstallFreighterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  /**
   * #649 — Social sign-in options, injected by `WalletContext`. Passed in rather
   * than imported so this modal stays free of wallet-provider dependencies.
   */
  socialLogin?: ReactNode;
  /**
   * When true, the modal explains that Freighter is locked (password required)
   * rather than asking the user to install it.
   */
  isLocked?: boolean;
}

function detectBrowser(): { name: string; supported: boolean } {
  if (typeof navigator === "undefined") return { name: "Unknown", supported: false };
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("chrome") && !ua.includes("edg")) return { name: "Chrome", supported: true };
  if (ua.includes("edg")) return { name: "Edge", supported: true };
  if (ua.includes("firefox")) return { name: "Firefox", supported: true };
  if (ua.includes("safari")) return { name: "Safari", supported: false };
  return { name: "Other", supported: false };
}

export type FreighterStatus = "unsupported" | "locked" | "notInstalled";

/** What the Freighter option's status badge says in the wallet drawer (#1349). */
export function getFreighterStatus({
  isLocked,
  browser,
}: {
  isLocked: boolean;
  browser: { name: string; supported: boolean };
}): FreighterStatus {
  if (isLocked) return "locked";
  if (browser.name && !browser.supported) return "unsupported";
  return "notInstalled";
}

const STATUS_BADGES: Record<FreighterStatus, { label: string; className: string }> = {
  notInstalled: {
    label: "Not detected",
    className: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  },
  locked: {
    label: "Locked",
    className: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  },
  unsupported: {
    label: "Browser not supported",
    className: "bg-red-500/10 text-red-700 ring-red-500/30 dark:text-red-300",
  },
};

export default function InstallFreighterModal({
  isOpen,
  onClose,
  onRetry,
  socialLogin,
  isLocked = false,
}: InstallFreighterModalProps) {
  const browser = useMemo(
    () => (isOpen ? detectBrowser() : { name: "", supported: false }),
    [isOpen],
  );
  const [checking, setChecking] = useState(false);

  const handleRetry = async () => {
    setChecking(true);
    await new Promise((r) => setTimeout(r, 500));
    onRetry();
    setChecking(false);
  };

  const status = getFreighterStatus({ isLocked, browser });
  const badge = STATUS_BADGES[status];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="drawer"
      ariaLabelledBy="install-freighter-title"
      ariaDescribedBy="install-freighter-description"
    >
      <div className="relative p-6 sm:p-8">
        {/* Grab handle on the mobile bottom sheet. */}
        <span
          aria-hidden="true"
          className="mx-auto -mt-2 mb-4 block h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600 sm:hidden"
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors duration-(--duration-snappy) hover:bg-zinc-900/5 hover:text-zinc-800 focus-ring dark:hover:bg-white/10 dark:hover:text-zinc-100"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand via-accent to-success text-white shadow-lg shadow-accent/25">
          <Wallet size={22} aria-hidden="true" />
        </div>

        <h2
          id="install-freighter-title"
          className="pr-10 text-xl font-bold text-zinc-900 dark:text-zinc-50"
        >
          {socialLogin
            ? "Connect a wallet"
            : isLocked
              ? "Freighter Wallet Locked"
              : "Freighter Wallet Required"}
        </h2>

        <p
          id="install-freighter-description"
          className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"
        >
          {socialLogin
            ? "Install the Freighter extension, or sign in with a social account and we will create a Stellar wallet for you."
            : isLocked
              ? "Open the Freighter extension and unlock it with your password, then try again."
              : "This app requires the Freighter browser extension to interact with the Stellar network."}
        </p>

        <section
          aria-labelledby="freighter-option-title"
          className="gradient-border mt-6 rounded-2xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-xl"
            >
              🚀
            </span>
            <div className="min-w-0 flex-1">
              <h3
                id="freighter-option-title"
                className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
              >
                Freighter
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Browser extension</p>
            </div>
            <span
              data-testid="freighter-status"
              data-status={status}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>

          {status === "unsupported" && (
            <div className="mt-3 rounded-xl border border-red-300/60 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              Freighter does not support <strong>{browser.name}</strong>. Please use Chrome, Edge,
              or Firefox.
            </div>
          )}

          <div className="mt-4 space-y-2">
            {isLocked ? (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50/80 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Freighter is locked. Open the extension in your browser toolbar, enter your
                password, and then click the button below.
              </div>
            ) : (
              <a
                href="https://www.freighter.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 w-full items-center justify-center rounded-full bg-gradient-to-r from-brand to-accent px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand/20 transition duration-(--duration-snappy) hover:brightness-110 focus-ring motion-safe:hover:-translate-y-px"
              >
                Install Freighter
              </a>
            )}

            <button
              type="button"
              onClick={() => void handleRetry()}
              disabled={checking}
              className="min-h-11 w-full rounded-full border border-zinc-300/80 bg-white/50 px-4 py-3 text-sm font-medium text-zinc-700 transition duration-(--duration-snappy) hover:bg-white/90 focus-ring disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
            >
              {checking
                ? "Checking..."
                : isLocked
                  ? "I unlocked it — check again"
                  : "I installed it — check again"}
            </button>
          </div>
        </section>

        {socialLogin && <div className="mt-6">{socialLogin}</div>}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 text-xs text-zinc-500 transition hover:text-zinc-700 focus-ring dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Not now
        </button>
      </div>
    </Modal>
  );
}

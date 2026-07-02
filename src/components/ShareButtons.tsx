"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ToastProvider";

interface ShareButtonsProps {
  url?: string;
  title: string;
  walletAddress?: string;
}

function QRModal({
  url,
  walletAddress,
  onClose,
}: {
  url: string;
  walletAddress?: string;
  onClose: () => void;
}) {
  const qrBase = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&ecc=M&data=";

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="QR codes"
        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close QR modal"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">QR Codes</h2>

        <div className={`flex gap-6 ${walletAddress ? "flex-wrap sm:flex-nowrap" : ""}`}>
          {/* Campaign URL QR */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Campaign URL</p>
            <img
              src={`${qrBase}${encodeURIComponent(url)}`}
              alt="QR code for campaign URL"
              width={200}
              height={200}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700"
            />
            <a
              href={`${qrBase}${encodeURIComponent(url)}`}
              download="campaign-qr.png"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Download
            </a>
          </div>

          {/* Wallet address QR */}
          {walletAddress && (
            <div className="flex flex-col items-center gap-2 flex-1">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Contribution Address
              </p>
              <img
                src={`${qrBase}${encodeURIComponent(walletAddress)}`}
                alt="QR code for contribution wallet address"
                width={200}
                height={200}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700"
              />
              <a
                href={`${qrBase}${encodeURIComponent(walletAddress)}`}
                download="wallet-qr.png"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Download
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShareButtons({ url, title, walletAddress }: ShareButtonsProps) {
  const { showSuccess } = useToast();
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  if (!url) return null;

  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showSuccess("Copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      showSuccess("Copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled — ignore
      }
      return;
    }
    handleCopy();
  };

  const isMobile = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
          Share:
        </span>

        {/* Copy Link */}
        <button
          type="button"
          onClick={isMobile ? handleNativeShare : handleCopy}
          aria-label="Copy link"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
        >
          {copied ? (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-green-500"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy Link
            </>
          )}
        </button>

        {/* X (Twitter) */}
        <a
          href={`https://x.com/intent/tweet?text=${encodedTitle}&url=${encoded}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on X"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
        >
          {/* X logo */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          X
        </a>

        {/* LinkedIn */}
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on LinkedIn"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
        >
          {/* LinkedIn logo */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          LinkedIn
        </a>

        {/* QR */}
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          aria-label="Show QR code"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none" />
            <rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none" />
            <rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none" />
            <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3" />
          </svg>
          QR
        </button>
      </div>

      {qrOpen && (
        <QRModal url={url} walletAddress={walletAddress} onClose={() => setQrOpen(false)} />
      )}
    </>
  );
}

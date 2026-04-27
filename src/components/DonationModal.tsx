"use client";

import { useState, useEffect, useRef } from "react";
import { contribute } from "../lib/contractClient";
import { Campaign, xlmToStroops, stroopsToXlm } from "../types";
import { useToast } from "./ToastProvider";
import { useWallet } from "./WalletContext";
import { parseContractError } from "../utils/contractErrors";

const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://stellar.expert/explorer/testnet/tx";

interface DonationModalProps {
  campaign: Campaign;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "input" | "pending" | "confirmed";

export default function DonationModal({ campaign, onClose, onSuccess }: DonationModalProps) {
  const { publicKey } = useWallet();
  const { showError } = useToast();

  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Body scroll lock + focus restoration
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    };
  }, []);

  // ESC to close + focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "pending") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
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
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [step, onClose]);

  const goal = stroopsToXlm(campaign.funding_goal);
  const raised = stroopsToXlm(campaign.amount_raised);
  const amountNum = parseFloat(amount) || 0;
  const newRaised = raised + amountNum;
  const newPct = goal > 0 ? Math.min(100, Math.round((newRaised / goal) * 100)) : 0;
  const currentPct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

  const handleDonate = async () => {
    if (!publicKey) return;
    if (amountNum <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    setError(null);
    setStep("pending");
    try {
      const stroops = xlmToStroops(amountNum);
      const hash = await contribute(campaign.id, publicKey, stroops);
      setTxHash(hash);
      setStep("confirmed");
      onSuccess();
    } catch (err) {
      const msg = parseContractError(err);
      showError(msg);
      setError(msg);
      setStep("input");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && step !== "pending" && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && step !== "pending") {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="donation-modal-title"
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-700 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 id="donation-modal-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {step === "confirmed" ? "Donation Confirmed" : "Fund This Cause"}
          </h2>
          {step !== "pending" && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors text-2xl leading-none"
            >
              ×
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Campaign title */}
          <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">{campaign.title}</p>

          {/* Current progress */}
          <div>
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span>{currentPct}% funded</span>
              <span>
                {raised.toLocaleString(undefined, { maximumFractionDigits: 2 })} /{" "}
                {goal.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
              </span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
              <div
                className="bg-linear-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${step === "confirmed" ? newPct : currentPct}%` }}
              />
            </div>
          </div>

          {/* Input step */}
          {step === "input" && (
            <>
              <div>
                <label
                  htmlFor="donation-amount"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  Amount (XLM)
                </label>
                <div className="relative">
                  <input
                    id="donation-amount"
                    type="number"
                    min="0.0000001"
                    step="any"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError(null);
                    }}
                    placeholder="e.g. 10"
                    className="w-full px-4 py-3 pr-16 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-400">
                    XLM
                  </span>
                </div>
                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
              </div>

              {/* Preview progress if amount entered */}
              {amountNum > 0 && (
                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
                  After your donation: {newPct}% funded
                  {newRaised >= goal && (
                    <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                      🎉 Goal reached!
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={handleDonate}
                disabled={!publicKey || amountNum <= 0}
                className="w-full py-3 bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200"
              >
                Donate {amountNum > 0 ? `${amountNum} XLM` : ""}
              </button>
            </>
          )}

          {/* Pending step */}
          {step === "pending" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent motion-safe:animate-spin" />
              <p className="text-zinc-600 dark:text-zinc-400 text-sm text-center">
                Waiting for Freighter signature and transaction confirmation…
              </p>
            </div>
          )}

          {/* Confirmed step */}
          {step === "confirmed" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-3xl">
                ✓
              </div>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {amountNum} XLM donated successfully
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Thank you for supporting this cause.
                </p>
              </div>
              {txHash && (
                <a
                  href={`${EXPLORER_BASE}/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                >
                  View on Stellar Explorer →
                </a>
              )}
              <button
                onClick={onClose}
                className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

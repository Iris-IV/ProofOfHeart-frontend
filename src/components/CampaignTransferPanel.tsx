"use client";

import * as StellarSdk from "@stellar/stellar-sdk";
import { useEffect, useState } from "react";
import { Loader2, ArrowRightLeft, XCircle, CheckCircle, UserPlus } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { useWallet } from "@/components/WalletContext";
import {
  getCampaignTransfer,
  initiateCampaignTransfer,
  acceptCampaignTransfer,
  cancelCampaignTransfer,
} from "@/lib/contractClient";
import type { TransactionLifecyclePhase } from "@/lib/contractClient";
import { isSameAddress } from "@/lib/stellar";
import { parseContractError } from "@/utils/contractErrors";

interface CampaignTransferPanelProps {
  campaignId: number;
  creator: string;
  onTransferComplete: () => void;
}

export default function CampaignTransferPanel({
  campaignId,
  creator,
  onTransferComplete,
}: CampaignTransferPanelProps) {
  const { publicKey } = useWallet();
  const { showSuccess, showError, showWarning } = useToast();

  const [pendingRecipient, setPendingRecipient] = useState<string | null>(null);
  const [isLoadingTransfer, setIsLoadingTransfer] = useState(true);
  const [transferInput, setTransferInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [txPhase, setTxPhase] = useState<TransactionLifecyclePhase | null>(null);

  const isCreator = publicKey ? isSameAddress(creator, publicKey) : false;
  const isRecipient =
    publicKey && pendingRecipient ? isSameAddress(pendingRecipient, publicKey) : false;

  const txPhaseLabel =
    txPhase === "building"
      ? "Preparing…"
      : txPhase === "signing"
        ? "Sign in wallet…"
        : txPhase === "submitting"
          ? "Submitting…"
          : txPhase === "confirming"
            ? "Confirming…"
            : null;

  // Load pending transfer status
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const transfer = await getCampaignTransfer(campaignId);
        if (!cancelled) setPendingRecipient(transfer);
      } catch {
        // No pending transfer or error — treat as none
        if (!cancelled) setPendingRecipient(null);
      } finally {
        if (!cancelled) setIsLoadingTransfer(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  // Refresh pending transfer after actions
  const refreshTransfer = async () => {
    try {
      const transfer = await getCampaignTransfer(campaignId);
      setPendingRecipient(transfer);
    } catch {
      setPendingRecipient(null);
    }
  };

  const handleInitiateTransfer = async () => {
    if (!publicKey) {
      showWarning("Please connect your wallet first.");
      return;
    }
    const address = transferInput.trim();
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
      showError("Please enter a valid Stellar public key (G…).");
      return;
    }
    setIsProcessing(true);
    setTxPhase(null);
    try {
      await initiateCampaignTransfer(campaignId, address, {
        onStatus: ({ phase }) => setTxPhase(phase),
      });
      showSuccess("Transfer initiated. The recipient must accept it.");
      setTransferInput("");
      await refreshTransfer();
      onTransferComplete();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsProcessing(false);
      setTxPhase(null);
    }
  };

  const handleAcceptTransfer = async () => {
    if (!publicKey) {
      showWarning("Please connect your wallet first.");
      return;
    }
    setIsProcessing(true);
    setTxPhase(null);
    try {
      await acceptCampaignTransfer(campaignId, {
        onStatus: ({ phase }) => setTxPhase(phase),
      });
      showSuccess("Campaign ownership transferred successfully!");
      setPendingRecipient(null);
      onTransferComplete();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsProcessing(false);
      setTxPhase(null);
    }
  };

  const handleCancelTransfer = async () => {
    if (!publicKey) return;
    setIsProcessing(true);
    setTxPhase(null);
    try {
      await cancelCampaignTransfer(campaignId, {
        onStatus: ({ phase }) => setTxPhase(phase),
      });
      showSuccess("Transfer cancelled.");
      setPendingRecipient(null);
      onTransferComplete();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsProcessing(false);
      setTxPhase(null);
    }
  };

  if (isLoadingTransfer) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 size={14} className="motion-safe:animate-spin" />
          Loading transfer status…
        </div>
      </div>
    );
  }

  // ── Recipient view: banner to accept pending transfer ──
  if (isRecipient && pendingRecipient) {
    return (
      <div className="bg-linear-to-br from-blue-50 to-indigo-100/50 dark:from-blue-900/10 dark:to-zinc-800 rounded-xl shadow-sm border border-blue-200 dark:border-blue-900/30 p-5">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center shrink-0">
            <ArrowRightLeft size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-1">
              Campaign Ownership Transfer
            </h3>
            <p className="text-xs text-blue-700/70 dark:text-blue-300/70 mb-3">
              The creator has started a transfer of this campaign to you. Accept to become the new
              owner.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAcceptTransfer}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={14} className="motion-safe:animate-spin" />
                    {txPhaseLabel ?? "Accepting…"}
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} />
                    Accept Transfer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Creator view ──
  if (isCreator) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRightLeft size={16} className="text-purple-500" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Transfer Ownership
          </h2>
        </div>

        {pendingRecipient ? (
          // Pending transfer — show recipient + cancel
          <div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-lg p-3 mb-4">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
                Pending Transfer
              </p>
              <p className="font-mono text-xs text-zinc-800 dark:text-zinc-200 break-all">
                {pendingRecipient.slice(0, 10)}...{pendingRecipient.slice(-6)}
              </p>
            </div>
            <button
              onClick={handleCancelTransfer}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-semibold rounded-lg border border-red-200 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40 transition disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={14} className="motion-safe:animate-spin" />
                  {txPhaseLabel ?? "Cancelling…"}
                </>
              ) : (
                <>
                  <XCircle size={14} />
                  Cancel Transfer
                </>
              )}
            </button>
          </div>
        ) : (
          // No pending transfer — show initiate form
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 leading-relaxed">
              Transfer this campaign to another Stellar address. The recipient must accept the
              transfer to complete it.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={transferInput}
                onChange={(e) => setTransferInput(e.target.value)}
                placeholder="G…"
                className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:border-purple-500 focus:outline-none transition"
              />
              <button
                onClick={handleInitiateTransfer}
                disabled={isProcessing || !transferInput.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition disabled:opacity-50 shrink-0"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={14} className="motion-safe:animate-spin" />
                    {txPhaseLabel ?? "Transferring…"}
                  </>
                ) : (
                  <>
                    <UserPlus size={14} />
                    Transfer
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not creator, not recipient — show nothing
  return null;
}

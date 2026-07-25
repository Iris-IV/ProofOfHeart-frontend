"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useMultiSigProposals } from "../hooks/useMultiSigProposals";
import { Campaign } from "../types";
import { withdrawFunds } from "../lib/contractClient";
import { isSameAddress } from "../lib/stellar";
import { useToast } from "./ToastProvider";
import { parseContractError } from "../utils/contractErrors";
import { stroopsToXlmNumber } from "@/lib/stellarAmount";
import { formatNumber } from "@/lib/formatters";
import { explorerTxUrl } from "@/utils/explorer";
import {
  type TransactionLifecyclePhase,
  type TransactionLifecycleOptions,
} from "../lib/contractClient";
import { useWriteGuard } from "../hooks/useWriteGuard";

interface MultiSigWithdrawalPanelProps {
  campaign: Campaign;
  walletAddress: string | null;
  platformFeeBps?: number;
  onWithdrawSuccess?: () => void;
}

function AddressInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 min-w-0 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

export default function MultiSigWithdrawalPanel({
  campaign,
  walletAddress,
  platformFeeBps = 300,
  onWithdrawSuccess,
}: MultiSigWithdrawalPanelProps) {
  const t = useTranslations("MultiSigPanel");
  const locale = useLocale();
  const { showError, showSuccess } = useToast();
  const { invoke, isPending } = useWriteGuard();
  const isWithdrawing = isPending("multiSigWithdraw", campaign.id);

  const { activeProposal, createProposal, signProposal, cancelProposal, markExecuted } =
    useMultiSigProposals(campaign.id, walletAddress);

  const [showSetup, setShowSetup] = useState(false);
  const [signerInputs, setSignerInputs] = useState<string[]>(["", ""]);
  const [requiredSigs, setRequiredSigs] = useState(2);
  const [txPhase, setTxPhase] = useState<TransactionLifecyclePhase | null>(null);

  const isCreator = isSameAddress(walletAddress, campaign.creator);
  const totalRaised = stroopsToXlmNumber(campaign.amount_raised);
  const feeAmount = totalRaised * (platformFeeBps / 10000);
  const creatorAmount = totalRaised - feeAmount;

  const formatXlm = (value: number) =>
    formatNumber(value, locale, { maximumFractionDigits: 2, minimumFractionDigits: 0 });

  const canWithdraw =
    !campaign.is_cancelled &&
    !campaign.funds_withdrawn &&
    campaign.amount_raised >= campaign.funding_goal;

  if (!canWithdraw) return null;

  const isSignerOfActive =
    activeProposal && activeProposal.signers.some((s) => isSameAddress(s.address, walletAddress));

  const mySignature =
    activeProposal?.signers.find((s) => isSameAddress(s.address, walletAddress)) ?? null;

  const signedCount = activeProposal?.signers.filter((s) => !!s.signedAt).length ?? 0;

  const handleCreateProposal = () => {
    const valid = signerInputs.map((s) => s.trim()).filter(Boolean);
    if (valid.length === 0) {
      showError(t("errorNoSigners"));
      return;
    }
    if (requiredSigs < 1 || requiredSigs > valid.length) {
      showError(t("errorInvalidThreshold"));
      return;
    }
    createProposal(valid, requiredSigs);
    setShowSetup(false);
    setSignerInputs(["", ""]);
    showSuccess(t("proposalCreated"));
  };

  const handleSign = () => {
    if (!activeProposal) return;
    signProposal(activeProposal.id);
    showSuccess(t("signedSuccess"));
  };

  const handleExecuteWithdrawal = async () => {
    if (!activeProposal) return;
    setTxPhase(null);
    await invoke("multiSigWithdraw", campaign.id, async () => {
      try {
        const hash = await withdrawFunds(campaign.id, {
          onStatus: ({ phase }) => setTxPhase(phase),
        } as TransactionLifecycleOptions);
        markExecuted(activeProposal.id, hash);
        showSuccess(t("withdrawalSuccess", { amount: formatXlm(creatorAmount) }));
        onWithdrawSuccess?.();
      } catch (err) {
        showError(parseContractError(err));
        throw err;
      } finally {
        setTxPhase(null);
      }
    });
  };

  const handleAddSigner = () => setSignerInputs((prev) => [...prev, ""]);

  const handleRemoveSigner = (idx: number) =>
    setSignerInputs((prev) => prev.filter((_, i) => i !== idx));

  const handleSignerChange = (idx: number, value: string) =>
    setSignerInputs((prev) => prev.map((v, i) => (i === idx ? value : v)));

  if (activeProposal?.status === "executed") {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-5">
        <p className="text-sm font-semibold text-green-800 dark:text-green-200">
          {t("executedTitle")}
        </p>
        {activeProposal.txHash && (
          <a
            href={explorerTxUrl(activeProposal.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-800"
          >
            {t("viewOnExplorer")}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <svg
          className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4.13a4 4 0 10-8 0 4 4 0 008 0z"
          />
        </svg>
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t("title")}</h4>
      </div>

      {!activeProposal ? (
        <>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">{t("description")}</p>
          {isCreator && !showSetup && (
            <button
              onClick={() => setShowSetup(true)}
              className="px-4 py-2 min-h-[40px] text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {t("setupProposal")}
            </button>
          )}

          {isCreator && showSetup && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t("signersLabel")}
                </label>
                <div className="space-y-2">
                  {signerInputs.map((val, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <AddressInput
                        value={val}
                        onChange={(v) => handleSignerChange(idx, v)}
                        placeholder={t("signerPlaceholder")}
                      />
                      {signerInputs.length > 1 && (
                        <button
                          onClick={() => handleRemoveSigner(idx)}
                          className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                          aria-label={t("removeSigner")}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleAddSigner}
                  className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  + {t("addSigner")}
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {t("thresholdLabel")}
                </label>
                <input
                  type="number"
                  min={1}
                  max={signerInputs.filter(Boolean).length || 1}
                  value={requiredSigs}
                  onChange={(e) => setRequiredSigs(Number(e.target.value))}
                  className="w-24 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {t("thresholdOf", { total: signerInputs.filter(Boolean).length })}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreateProposal}
                  className="px-4 py-2 min-h-[40px] text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {t("createProposal")}
                </button>
                <button
                  onClick={() => setShowSetup(false)}
                  className="px-4 py-2 min-h-[40px] text-sm text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {t("signaturesProgress", {
                signed: signedCount,
                required: activeProposal.requiredSignatures,
              })}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                activeProposal.status === "ready"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
              }`}
            >
              {activeProposal.status === "ready" ? t("statusReady") : t("statusPending")}
            </span>
          </div>

          <div className="w-full bg-zinc-100 dark:bg-zinc-700 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{
                width: `${Math.min(100, (signedCount / activeProposal.requiredSignatures) * 100)}%`,
              }}
            />
          </div>

          <ul className="space-y-1.5">
            {activeProposal.signers.map((signer) => (
              <li key={signer.address} className="flex items-center gap-2 text-xs">
                {signer.signedAt ? (
                  <svg
                    className="w-3.5 h-3.5 text-green-500 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <span className="font-mono text-zinc-600 dark:text-zinc-400 break-all">
                  {signer.address.slice(0, 8)}…{signer.address.slice(-6)}
                </span>
                {signer.signedAt && (
                  <span className="text-zinc-400 dark:text-zinc-500">
                    {new Date(signer.signedAt * 1000).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-2">
            {isSignerOfActive && !mySignature?.signedAt && (
              <button
                onClick={handleSign}
                className="flex-1 px-4 py-2.5 min-h-[40px] text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                {t("signProposal")}
              </button>
            )}

            {isCreator && activeProposal.status === "ready" && (
              <button
                onClick={handleExecuteWithdrawal}
                disabled={isWithdrawing}
                className="flex-1 px-4 py-2.5 min-h-[40px] text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isWithdrawing
                  ? txPhase === "signing"
                    ? t("signing")
                    : txPhase === "confirming"
                      ? t("confirming")
                      : t("processing")
                  : t("executeWithdrawal", { amount: formatXlm(creatorAmount) })}
              </button>
            )}

            {isCreator && (
              <button
                onClick={() => cancelProposal(activeProposal.id)}
                disabled={isWithdrawing}
                className="px-4 py-2.5 min-h-[40px] text-sm text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                {t("cancelProposal")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

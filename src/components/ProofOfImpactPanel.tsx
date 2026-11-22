"use client";

import { ChangeEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { BadgeCheck, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { useWallet } from "@/components/WalletContext";
import { getAdmin, getProofOfImpact, recordProofOfImpact } from "@/lib/contractClient";
import type { ProofOfImpact } from "@/lib/contractClient";
import { compareProofHash, ipfsEvidenceUrl, sha256Hex } from "@/lib/proofOfImpact";
import type { ProofCheckResult } from "@/lib/proofOfImpact";
import { isSameAddress } from "@/lib/stellar";
import { formatDate } from "@/lib/formatters";
import { formatAddress } from "@/lib/formatAddress";
import { parseContractError } from "@/utils/contractErrors";

interface ProofOfImpactPanelProps {
  campaignId: number;
}

/**
 * Shows the on-chain proof-of-impact (issue #1773): an "Impact verified" badge, the recorded
 * SHA-256, and a hash check against the evidence. The platform admin (verifier) can record it.
 */
export default function ProofOfImpactPanel({ campaignId }: ProofOfImpactPanelProps) {
  const t = useTranslations("ProofOfImpact");
  const tContractErrors = useTranslations("ContractErrors");
  const locale = useLocale();
  const { publicKey } = useWallet();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const proofQuery = useQuery<ProofOfImpact | null, Error>({
    queryKey: ["proofOfImpact", campaignId],
    queryFn: () => getProofOfImpact(campaignId),
    staleTime: 60_000,
  });
  const { data: adminAddress } = useQuery<string, Error>({
    queryKey: ["admin"],
    queryFn: getAdmin,
    staleTime: 5 * 60_000,
  });

  const [isRecording, setIsRecording] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [evidenceRef, setEvidenceRef] = useState("");
  const [checkResult, setCheckResult] = useState<ProofCheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const localize = (message: string) =>
    message.startsWith("ContractErrors.")
      ? tContractErrors(message.replace("ContractErrors.", ""))
      : message;

  const proof = proofQuery.data ?? null;
  const isVerifier = !!publicKey && !!adminAddress && isSameAddress(publicKey, adminAddress);
  const evidenceUrl = ipfsEvidenceUrl(evidenceRef);

  const handleRecord = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !publicKey) return;
    setIsRecording(true);
    try {
      const hash = await sha256Hex(await file.arrayBuffer());
      await recordProofOfImpact(campaignId, publicKey, hash);
      showSuccess(t("recordSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["proofOfImpact", campaignId] });
    } catch (err) {
      showError(localize(parseContractError(err)));
    } finally {
      setIsRecording(false);
    }
  };

  const runCheck = async (load: () => Promise<ArrayBuffer>) => {
    if (!proof) return;
    setIsChecking(true);
    setCheckResult(null);
    setCheckError(null);
    try {
      setCheckResult(compareProofHash(proof.proofHash, await sha256Hex(await load())));
    } catch {
      setCheckError(t("checkError"));
    } finally {
      setIsChecking(false);
    }
  };

  const handleCheckFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void runCheck(() => file.arrayBuffer());
  };

  const handleCheckLink = () => {
    if (!evidenceUrl) {
      setCheckResult(null);
      setCheckError(t("invalidReference"));
      return;
    }
    void runCheck(async () => {
      const res = await fetch(evidenceUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.arrayBuffer();
    });
  };

  if (proofQuery.isLoading) {
    return (
      <div
        className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden="true" />
        {t("loading")}
      </div>
    );
  }

  if (proofQuery.isError) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
        role="alert"
      >
        <p>{t("loadError")}</p>
        <button
          type="button"
          onClick={() => void proofQuery.refetch()}
          className="mt-2 font-semibold underline"
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  // Nothing to show donors and nobody who can record one.
  if (!proof && !isVerifier) return null;

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
      aria-labelledby="proof-of-impact-title"
    >
      <h2
        id="proof-of-impact-title"
        className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50"
      >
        {t("title")}
        {proof && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
            <BadgeCheck size={14} aria-hidden="true" />
            {t("verifiedBadge")}
          </span>
        )}
      </h2>

      {proof ? (
        <div className="space-y-3 text-sm">
          <dl className="space-y-1 text-zinc-600 dark:text-zinc-300">
            <div className="flex justify-between gap-3">
              <dt>{t("recordedBy")}</dt>
              <dd className="font-mono">{formatAddress(proof.verifier)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>{t("recordedOn")}</dt>
              <dd>{formatDate(proof.timestamp, locale)}</dd>
            </div>
            <div>
              <dt>{t("hashLabel")}</dt>
              <dd className="mt-1 break-all font-mono text-xs">{proof.proofHash}</dd>
            </div>
          </dl>

          <div className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-700">
            <label
              htmlFor={`proof-evidence-${campaignId}`}
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-200"
            >
              {t("checkLabel")}
            </label>
            <div className="flex gap-2">
              <input
                id={`proof-evidence-${campaignId}`}
                type="text"
                value={evidenceRef}
                onChange={(e) => setEvidenceRef(e.target.value)}
                placeholder={t("checkPlaceholder")}
                disabled={isChecking}
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={handleCheckLink}
                disabled={isChecking || !evidenceRef.trim()}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {isChecking ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  t("checkButton")
                )}
              </button>
            </div>
            {evidenceUrl && (
              <a
                href={evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300"
              >
                {t("viewEvidence")}
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
            <label className="block text-xs text-zinc-500 dark:text-zinc-400">
              {t("checkFile")}
              <input
                type="file"
                onChange={handleCheckFile}
                disabled={isChecking}
                className="mt-1 block w-full text-xs"
              />
            </label>
            <div aria-live="polite">
              {checkResult === "match" && (
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {t("hashMatch")}
                </p>
              )}
              {checkResult === "mismatch" && (
                <p className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                  <AlertTriangle size={12} aria-hidden="true" />
                  {t("hashMismatch")}
                </p>
              )}
              {checkError && (
                <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                  {checkError}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
          <p>{t("recordHelp")}</p>
          <label className="block text-xs font-semibold">
            {t("recordLabel")}
            <input
              type="file"
              onChange={(e) => void handleRecord(e)}
              disabled={isRecording}
              className="mt-1 block w-full text-xs font-normal"
            />
          </label>
          {isRecording && (
            <p className="flex items-center gap-2 text-xs" role="status">
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              {t("recording")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

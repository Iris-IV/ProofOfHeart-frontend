"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ToastProvider";
import { useWallet } from "@/components/WalletContext";
import {
  emergencyPausePlatform,
  getEmergencyPauseSigners,
  getPlatformStatus,
  pausePlatform,
  resumeCampaign,
  unpausePlatform,
} from "@/lib/contractClient";
import type { PlatformStatus, TransactionLifecyclePhase } from "@/lib/contractClient";
import { isSameAddress } from "@/lib/stellar";
import { parseContractError } from "@/utils/contractErrors";

type IncidentAction = "pause" | "unpause" | "emergencyPause" | "resume";

interface PendingAction {
  action: IncidentAction;
  campaignId?: number;
}

/**
 * "Incident controls" card for the admin console (issue #1778): current platform state,
 * pause / unpause / emergency pause / resume-campaign actions behind a confirmation dialog,
 * and the list of registered emergency signers.
 */
export default function IncidentControlsSection() {
  const t = useTranslations("Admin");
  const tContractErrors = useTranslations("ContractErrors");
  const { showSuccess, showError } = useToast();
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();

  const statusQuery = useQuery<PlatformStatus, Error>({
    queryKey: ["platformStatus"],
    queryFn: () => getPlatformStatus(true),
    staleTime: 15_000,
  });
  const signersQuery = useQuery<string[], Error>({
    queryKey: ["emergencyPauseSigners"],
    queryFn: () => getEmergencyPauseSigners(true),
    staleTime: 60_000,
  });

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txPhase, setTxPhase] = useState<TransactionLifecyclePhase | null>(null);
  const [resumeInput, setResumeInput] = useState("");

  const isPaused = statusQuery.data?.isPaused ?? false;
  const signers = signersQuery.data ?? [];
  const isEmergencySigner = !!publicKey && signers.some((s) => isSameAddress(s, publicKey));

  const localize = (message: string) =>
    message.startsWith("ContractErrors.")
      ? tContractErrors(message.replace("ContractErrors.", ""))
      : message;

  const phaseLabel =
    txPhase === "building"
      ? t("preparing")
      : txPhase === "signing"
        ? t("signing")
        : txPhase === "submitting"
          ? t("submitting")
          : txPhase === "confirming"
            ? t("confirming")
            : null;

  const requestResume = (event: FormEvent) => {
    event.preventDefault();
    const id = Number(resumeInput);
    if (!Number.isInteger(id) || id < 0) {
      showError(t("incident.invalidCampaignId"));
      return;
    }
    setPending({ action: "resume", campaignId: id });
  };

  const confirm = async () => {
    if (!pending || !publicKey) return;
    setIsSubmitting(true);
    setTxPhase(null);
    const options = {
      onStatus: ({ phase }: { phase: TransactionLifecyclePhase }) => setTxPhase(phase),
    };
    try {
      switch (pending.action) {
        case "pause":
          await pausePlatform(publicKey, options);
          break;
        case "unpause":
          await unpausePlatform(publicKey, options);
          break;
        case "emergencyPause":
          await emergencyPausePlatform(publicKey, options);
          break;
        case "resume":
          await resumeCampaign(pending.campaignId ?? 0, publicKey, options);
          setResumeInput("");
          break;
      }
      showSuccess(t(`incident.success.${pending.action}`));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["platformStatus"] }),
        queryClient.invalidateQueries({ queryKey: ["platformReport"] }),
      ]);
      setPending(null);
    } catch (err) {
      showError(localize(parseContractError(err)));
    } finally {
      setIsSubmitting(false);
      setTxPhase(null);
    }
  };

  const buttonBase =
    "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section
      className="rounded-[2.5rem] border border-red-100 bg-white p-8 shadow-sm dark:border-red-900/20 dark:bg-zinc-900"
      aria-labelledby="incident-controls-title"
    >
      <h3 id="incident-controls-title" className="mb-2 flex items-center gap-2 text-xl font-bold">
        <ShieldAlert size={20} aria-hidden="true" />
        {t("incident.title")}
      </h3>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">{t("incident.subtitle")}</p>

      <div className="mb-6 flex items-center gap-3" aria-live="polite">
        <span className="text-sm font-semibold">{t("incident.currentState")}</span>
        {statusQuery.isLoading ? (
          <span className="flex items-center gap-2 text-sm text-zinc-500" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t("incident.loading")}
          </span>
        ) : statusQuery.isError ? (
          <span className="text-sm text-red-600 dark:text-red-400" role="alert">
            {t("incident.stateError")}{" "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => void statusQuery.refetch()}
            >
              {t("incident.retry")}
            </button>
          </span>
        ) : (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isPaused
                ? "bg-red-500/10 text-red-700 dark:text-red-300"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {isPaused ? t("incident.statePaused") : t("incident.stateActive")}
          </span>
        )}
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <button
          type="button"
          className={`${buttonBase} bg-red-600 text-white hover:bg-red-700`}
          disabled={!publicKey || isPaused || isSubmitting}
          onClick={() => setPending({ action: "pause" })}
        >
          {t("incident.pause")}
        </button>
        <button
          type="button"
          className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`}
          disabled={!publicKey || !isPaused || isSubmitting}
          onClick={() => setPending({ action: "unpause" })}
        >
          {t("incident.unpause")}
        </button>
        <button
          type="button"
          className={`${buttonBase} border border-red-300 text-red-700 dark:border-red-800 dark:text-red-300`}
          disabled={!isEmergencySigner || isPaused || isSubmitting}
          title={isEmergencySigner ? undefined : t("incident.emergencySignerOnly")}
          onClick={() => setPending({ action: "emergencyPause" })}
        >
          {t("incident.emergencyPause")}
        </button>
      </div>

      <form onSubmit={requestResume} className="mb-8 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="incident-resume-id" className="mb-1 block text-sm font-semibold">
            {t("incident.resumeLabel")}
          </label>
          <input
            id="incident-resume-id"
            type="number"
            min="0"
            value={resumeInput}
            onChange={(e) => setResumeInput(e.target.value)}
            disabled={isSubmitting}
            className="w-40 rounded-xl border-2 border-zinc-100 bg-zinc-50 px-4 py-2.5 font-semibold dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        <button
          type="submit"
          className={`${buttonBase} bg-zinc-900 text-white dark:bg-white dark:text-zinc-900`}
          disabled={!publicKey || !resumeInput || isSubmitting}
        >
          {t("incident.resume")}
        </button>
      </form>

      <div>
        <h4 className="mb-2 text-sm font-semibold">{t("incident.signersTitle")}</h4>
        {signersQuery.isLoading ? (
          <p className="text-sm text-zinc-500" role="status">
            {t("incident.loading")}
          </p>
        ) : signersQuery.isError ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {t("incident.signersError")}
          </p>
        ) : signers.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("incident.noSigners")}</p>
        ) : (
          <ul className="space-y-1">
            {signers.map((signer) => (
              <li
                key={signer}
                className="break-all font-mono text-xs text-zinc-600 dark:text-zinc-300"
              >
                {signer}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        isOpen={pending !== null}
        onClose={() => !isSubmitting && setPending(null)}
        role="alertdialog"
        ariaLabelledBy="incident-confirm-title"
        ariaDescribedBy="incident-confirm-body"
      >
        <div className="p-6">
          <h3 id="incident-confirm-title" className="mb-2 text-lg font-bold">
            {pending ? t(`incident.confirmTitle.${pending.action}`) : ""}
          </h3>
          <p id="incident-confirm-body" className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            {pending
              ? t(`incident.confirmBody.${pending.action}`, { id: pending.campaignId ?? 0 })
              : ""}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-zinc-100 py-3 font-semibold disabled:opacity-50 dark:bg-zinc-800"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-zinc-950 py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden="true" />
                  {phaseLabel ?? t("awaitingSignature")}
                </>
              ) : (
                t("incident.confirm")
              )}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

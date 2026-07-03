"use client";

import * as StellarSdk from "@stellar/stellar-sdk";
import {
  CheckCircle,
  XCircle,
  ShieldAlert,
  Loader2,
  ExternalLink,
  Activity,
  DollarSign,
  PieChart,
  RefreshCw,
  Smartphone,
  Flag,
  AlertTriangle,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { useWallet } from "@/components/WalletContext";
import dynamic from "next/dynamic";

const AdminTwoFactorSetup = dynamic(() => import("@/components/admin/AdminTwoFactorSetup"), {
  ssr: false,
});
const CampaignMap = dynamic(() => import("@/components/CampaignMap"), {
  ssr: false,
});

const TransferAdminModal = dynamic(() => import("@/components/TransferAdminModal"), {
  ssr: false,
});
import { useCampaigns } from "@/hooks/useCampaigns";
import { Link } from "@/i18n/routing";
import { appendAdminAuditLog, AdminAuditLogEntry, getAdminAuditLog } from "@/lib/adminLog";
import {
  getAdmin,
  getPlatformFee,
  updateAdmin,
  updatePlatformFee,
  verifyCampaign,
  cancelCampaign,
} from "@/lib/contractClient";
import type { TransactionLifecyclePhase } from "@/lib/contractClient";
import { isSameAddress } from "@/lib/stellar";
import { formatAmount } from "@/lib/formatters";
import { Category, CATEGORY_LABELS, basisPointsToPercentage } from "@/types";
import { parseContractError } from "@/utils/contractErrors";
import { explorerTxUrl } from "@/utils/explorer";
import {
  getAllReports,
  markReportReviewed,
  REPORT_REASON_LABELS,
  type CampaignReport,
} from "@/lib/campaignReports";
const CancelCampaignModal = dynamic(() => import("@/components/cancelCampaignModal"), {
  ssr: false,
});
import { AdminSkeleton } from "@/components/Skeleton";
import { Campaign } from "@/types";
import { useContractVersion } from "@/hooks/useContractVersion";

export default function AdminDashboard() {
  const { campaigns, isLoading, refetch, isRefreshing } = useCampaigns();
  const { publicKey, isWalletConnected, connectWallet, isLoading: isWalletLoading } = useWallet();
  const {
    version: contractVersion,
    isMismatch: isVersionMismatch,
    expectedVersion,
  } = useContractVersion();
  const queryClient = useQueryClient();

  const { showSuccess, showError, showWarning } = useToast();
  const t = useTranslations("Admin");
  const locale = useLocale();

  const [adminAddress, setAdminAddress] = useState<string | null>(null);
  const [platformFee, setPlatformFee] = useState<number | null>(null);
  const [feeInput, setFeeInput] = useState("");
  const [newAdminInput, setNewAdminInput] = useState("");
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isFeeConfirmModalOpen, setIsFeeConfirmModalOpen] = useState(false);
  const [pendingFee, setPendingFee] = useState<number | null>(null);

  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [isUpdatingFee, setIsUpdatingFee] = useState(false);
  const [isUpdatingAdmin, setIsUpdatingAdmin] = useState(false);
  const [auditLog, setAuditLog] = useState<AdminAuditLogEntry[]>([]);
  const [reports, setReports] = useState<CampaignReport[]>([]);
  const [txPhase, setTxPhase] = useState<TransactionLifecyclePhase | null>(null);
  const txPhaseLabel =
    txPhase === "building"
      ? t("preparing")
      : txPhase === "signing"
        ? t("signing")
        : txPhase === "submitting"
          ? t("submitting")
          : txPhase === "confirming"
            ? t("confirming")
            : null;

  // Load reports from backend on mount
  useEffect(() => {
    getAllReports()
      .then(setReports)
      .catch(() => setReports([]));
  }, []);

  // Rejection Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [campaignToReject, setCampaignToReject] = useState<Campaign | null>(null);

  // Optimistic UI State
  const [optimisticPendingIds, setOptimisticPendingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const [addr, fee] = await Promise.all([getAdmin(), getPlatformFee()]);
        if (cancelled) return;
        setAdminAddress(addr);
        setPlatformFee(fee);
        setFeeInput(String(fee));
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setIsAdminLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reconcile optimistic updates when raw data changes
  useEffect(() => {
    if (optimisticPendingIds.size === 0) return;

    // Remove IDs from optimistic list if they are no longer in the "actually pending" server data
    setOptimisticPendingIds((prev) => {
      const next = new Set(prev);
      for (const id of prev) {
        const isStillInServerData = campaigns.some(
          (c) => c.id === id && !c.is_verified && c.is_active && !c.is_cancelled,
        );
        if (!isStillInServerData) next.delete(id);
      }
      return next;
    });
  }, [campaigns]);

  const isAdmin = useMemo(() => {
    return isSameAddress(publicKey, adminAddress);
  }, [publicKey, adminAddress]);

  const refreshAuditLog = async (address = publicKey) => {
    if (!address) {
      setAuditLog([]);
      return;
    }
    setAuditLog(await getAdminAuditLog(address, 50));
  };

  const pendingCampaigns = useMemo(() => {
    return campaigns.filter(
      (c) => !c.is_verified && c.is_active && !c.is_cancelled && !optimisticPendingIds.has(c.id),
    );
  }, [campaigns, optimisticPendingIds]);

  const totalRaised = useMemo(() => {
    return campaigns.reduce((sum, c) => sum + BigInt(c.amount_raised), BigInt(0));
  }, [campaigns]);

  const activeCampaignCount = useMemo(() => {
    return campaigns.filter((c) => c.is_active && !c.is_cancelled).length;
  }, [campaigns]);

  const handleApprove = async (id: number) => {
    setVerifyingId(id);
    setTxPhase(null);
    try {
      const txHash = await verifyCampaign(id, {
        onStatus: ({ phase }) => setTxPhase(phase),
      });
      if (publicKey) {
        await appendAdminAuditLog({
          adminAddress: publicKey,
          action: "verify_campaign",
          campaignId: id,
          txHash,
          details: `Approved campaign #${id}`,
        });
        await refreshAuditLog(publicKey);
      }
      showSuccess(t("approveSuccess"));
      setOptimisticPendingIds((prev) => new Set(prev).add(id));
      refetch();
      queryClient.invalidateQueries({ queryKey: ["campaign", id] });
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setVerifyingId(null);
      setTxPhase(null);
    }
  };

  const handleReject = (campaign: Campaign) => {
    setCampaignToReject(campaign);
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!campaignToReject) return;
    setCancellingId(campaignToReject.id);
    setTxPhase(null);
    try {
      const txHash = await cancelCampaign(campaignToReject.id, {
        onStatus: ({ phase }) => setTxPhase(phase),
      });
      if (publicKey) {
        await appendAdminAuditLog({
          adminAddress: publicKey,
          action: "reject_campaign",
          campaignId: campaignToReject.id,
          txHash,
          details: `Rejected campaign #${campaignToReject.id}`,
        });
        await refreshAuditLog(publicKey);
      }
      showSuccess(t("rejectSuccess"));
      setOptimisticPendingIds((prev) => new Set(prev).add(campaignToReject.id));
      setIsRejectModalOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignToReject.id] });
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setCancellingId(null);
      setTxPhase(null);
    }
  };

  const handleMarkReportReviewed = async (reportId: string) => {
    try {
      await markReportReviewed(reportId);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: "reviewed" as const } : r)),
      );
      showSuccess(t("reportReviewedSuccess"));
    } catch (err) {
      showError(err instanceof Error ? err.message : t("reportReviewError"));
    }
  };

  const performFeeUpdate = async (fee: number) => {
    setIsUpdatingFee(true);
    setTxPhase(null);
    try {
      const txHash = await updatePlatformFee(fee, {
        onStatus: ({ phase }) => setTxPhase(phase),
      });
      if (publicKey) {
        const previousFeeLabel =
          platformFee === null ? "unknown" : `${(platformFee / 100).toFixed(2)}%`;
        await appendAdminAuditLog({
          adminAddress: publicKey,
          action: "update_platform_fee",
          txHash,
          details: `Updated platform fee from ${previousFeeLabel} to ${(fee / 100).toFixed(2)}% (${fee} bps)`,
        });
        await refreshAuditLog(publicKey);
      }
      setPlatformFee(fee);
      showSuccess(t("feeUpdateSuccess"));
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsUpdatingFee(false);
      setTxPhase(null);
    }
  };

  const handleUpdateFee = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return showWarning(t("adminOnlyFee"));

    const fee = Number(feeInput);
    if (isNaN(fee) || fee < 0 || fee > 10000) return showError(t("invalidFee"));

    if (fee > 1000) {
      setPendingFee(fee);
      setIsFeeConfirmModalOpen(true);
      return;
    }

    await performFeeUpdate(fee);
  };

  const handleConfirmFeeUpdate = async () => {
    if (pendingFee === null) return;
    setIsFeeConfirmModalOpen(false);
    await performFeeUpdate(pendingFee);
    setPendingFee(null);
  };

  const handleTransferAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return showWarning(t("adminOnlyTransfer"));

    const nextAdmin = newAdminInput.trim();
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(nextAdmin))
      return showError(t("invalidAddress"));

    setIsTransferModalOpen(true);
  };

  const executeTransferAdmin = async () => {
    const nextAdmin = newAdminInput.trim();
    setIsUpdatingAdmin(true);
    setTxPhase(null);
    try {
      const txHash = await updateAdmin(nextAdmin, {
        onStatus: ({ phase }) => setTxPhase(phase),
      });
      if (publicKey) {
        await appendAdminAuditLog({
          adminAddress: publicKey,
          action: "transfer_admin",
          txHash,
          details: `Transferred admin access to ${nextAdmin}`,
        });
        await refreshAuditLog(publicKey);
      }
      setAdminAddress(nextAdmin);
      setNewAdminInput("");
      showSuccess(t("adminTransferSuccess"));
      setIsTransferModalOpen(false);
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsUpdatingAdmin(false);
      setTxPhase(null);
    }
  };

  useEffect(() => {
    if (isAdmin && publicKey) {
      void refreshAuditLog(publicKey);
      return;
    }
    setAuditLog([]);
  }, [isAdmin, publicKey]);

  if (!isWalletConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <Smartphone size={64} className="text-zinc-300 mb-6 motion-safe:animate-pulse" />
        <h1 className="text-3xl font-bold mb-4 tracking-tight">{t("walletRequired")}</h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-md mb-8">{t("walletRequiredDesc")}</p>
        <button
          onClick={connectWallet}
          disabled={isWalletLoading}
          className="px-8 py-3 bg-zinc-950 dark:bg-amber-400 text-white dark:text-zinc-950 font-bold rounded-2xl transition hover:opacity-90 disabled:opacity-50"
        >
          {isWalletLoading ? t("connecting") : t("connectWallet")}
        </button>
      </div>
    );
  }

  if (isAdminLoading || isLoading) {
    return <AdminSkeleton />;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="size-20 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-3xl flex items-center justify-center mb-6">
          <ShieldAlert size={40} />
        </div>
        <h1 className="text-3xl font-bold mb-2 text-zinc-900 dark:text-zinc-50">
          {t("unauthorized")}
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-md mb-8">
          {t("unauthorizedDesc", { address: `${publicKey?.slice(0, 8)}...` })}
        </p>
        <Link
          href="/"
          className="px-8 py-3 bg-white border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition shadow-sm"
        >
          {t("returnHome")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      {/* Header Section */}
      <section className="relative overflow-hidden rounded-[2.5rem] border border-amber-200/50 bg-white dark:bg-zinc-900 p-8 sm:p-12 mb-12 shadow-2xl shadow-amber-500/5">
        <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none">
          <ShieldAlert size={180} className="rotate-12" />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-widest mb-6">
            <Activity size={14} />
            {t("adminConsole")}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-zinc-950 dark:text-zinc-50 mb-4 tracking-tight">
            {t("title")}
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
            {t("subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-3 shadow-sm min-w-0 max-w-full">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                {t("contractAdmin")}
              </span>
              <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 break-all">
                {adminAddress}
              </span>
            </div>
            <Link
              href="/admin/observability"
              className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              {t("observabilityLink")}
            </Link>
            <div
              className={`rounded-2xl border px-5 py-3 shadow-sm flex items-center gap-3 ${
                isVersionMismatch
                  ? "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-200"
                  : "bg-blue-50 border-blue-100 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800/40 dark:text-blue-200"
              }`}
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                  Contract Version
                </span>
                <span className="font-mono text-sm font-bold flex items-center gap-2">
                  {isVersionMismatch && <AlertTriangle size={14} />}v{contractVersion ?? "..."}
                  {isVersionMismatch && (
                    <span className="text-[10px] font-normal opacity-70">
                      (Expected v{expectedVersion})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 motion-safe:animate-in fade-in slide-in-from-bottom-4 duration-500">
        <StatsCard
          icon={<Activity className="text-blue-500" />}
          label={t("totalCampaigns")}
          value={campaigns.length}
        />
        <StatsCard
          icon={<DollarSign className="text-green-500" />}
          label={t("totalRaised")}
          value={`${formatAmount(totalRaised, locale)} XLM`}
        />
        <StatsCard
          icon={<PieChart className="text-purple-500" />}
          label={t("activeCampaigns")}
          value={activeCampaignCount}
        />
        <StatsCard
          icon={<ShieldAlert className="text-amber-500" />}
          label={t("platformFee")}
          value={platformFee !== null ? basisPointsToPercentage(platformFee) : "..."}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Verification Queue */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              {t("verificationQueue")}
              {/* zinc-500 on zinc-800 is ~3.2:1; zinc-300 on zinc-800 is ~8.5:1 — meets WCAG AA */}
              <span className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-300">
                {pendingCampaigns.length}
              </span>
            </h2>
            <button
              onClick={refetch}
              disabled={isRefreshing}
              className="group size-10 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition shadow-sm"
              title={t("refresh")}
              aria-label={t("refresh")}
            >
              <RefreshCw
                size={18}
                className={`${isRefreshing ? "motion-safe:animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`}
              />
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            {pendingCampaigns.length === 0 ? (
              <div className="p-20 text-center flex flex-col items-center">
                <div className="size-16 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 flex items-center justify-center mb-6">
                  <CheckCircle size={32} />
                </div>
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-1">
                  {t("noPending")}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pendingCampaigns.map((c) => (
                  <article
                    key={c.id}
                    className="p-8 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors group"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800">
                            #{c.id}
                          </span>
                          <span className="text-xs font-bold text-zinc-400 capitalize">
                            {CATEGORY_LABELS[c.category as Category]}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 group-hover:text-amber-600 transition-colors">
                          {c.title}
                        </h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 max-w-2xl mb-4">
                          {c.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400">{t("creator")}:</span>
                            <span className="font-mono text-zinc-600 dark:text-zinc-300">
                              {c.creator.slice(0, 6)}...{c.creator.slice(-6)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400">{t("goal")}:</span>
                            <span className="text-zinc-900 dark:text-zinc-100">
                              {formatAmount(BigInt(c.funding_goal), locale)} XLM
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex md:flex-col items-center gap-3">
                        <Link
                          href={`/causes/${c.id}`}
                          className="flex-1 md:w-full inline-flex items-center justify-center gap-2 px-6 py-3 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                        >
                          {t("reviewDetails")}
                          <ExternalLink size={14} />
                        </Link>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleReject(c)}
                            disabled={cancellingId === c.id || verifyingId === c.id}
                            className="size-12 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-100 dark:border-red-900/50 hover:bg-red-100 transition disabled:opacity-50"
                            title={t("reject")}
                          >
                            {cancellingId === c.id ? (
                              <Loader2 className="motion-safe:animate-spin" size={20} />
                            ) : (
                              <XCircle size={20} />
                            )}
                          </button>
                          <button
                            onClick={() => handleApprove(c.id)}
                            disabled={verifyingId === c.id || cancellingId === c.id}
                            className="size-12 flex items-center justify-center rounded-xl bg-green-500 text-white shadow-lg shadow-green-500/20 hover:bg-green-600 transition hover:motion-safe:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                            title={t("approve")}
                          >
                            {verifyingId === c.id ? (
                              <Loader2 className="motion-safe:animate-spin" size={20} />
                            ) : (
                              <CheckCircle size={20} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Control Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          {/* Platform Fee Control */}
          <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
            <h3 className="text-xl font-bold mb-2">{t("updatePlatformFee")}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 leading-relaxed">
              {t("feeDescription")}
            </p>
            <form onSubmit={handleUpdateFee} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3">
                  {t("feeInBasisPoints")}
                </label>
                <input
                  type="number"
                  value={feeInput}
                  onChange={(e) => setFeeInput(e.target.value)}
                  min="0"
                  max="10000"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 font-bold text-zinc-900 dark:text-zinc-50 focus:border-amber-500 focus:outline-none transition group-hover:border-amber-200"
                />
                {feeInput && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      = {(Number(feeInput) / 100).toFixed(2)}%
                    </p>
                    {Number(feeInput) > 1000 && (
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{t("feeWarning")}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={isUpdatingFee || Number(feeInput) > 10000 || Number(feeInput) < 0}
                className="w-full py-4 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-2xl font-black text-sm uppercase tracking-widest hover:opacity-90 active:scale-95 transition disabled:opacity-50"
              >
                {isUpdatingFee ? (txPhaseLabel ?? t("awaitingSignature")) : t("updatePlatformFee")}
              </button>
            </form>
          </section>

          {/* Admin Transfer Control */}
          <section className="bg-linear-to-br from-red-50 to-rose-100/50 dark:from-red-900/10 dark:to-zinc-900 rounded-[2.5rem] border border-red-100 dark:border-red-900/20 p-8 shadow-sm">
            <h3 className="text-xl font-bold mb-2 text-red-950 dark:text-red-400">
              {t("transferAdmin")}
            </h3>
            <p className="text-sm text-red-800/70 dark:text-red-400/70 mb-8 leading-relaxed">
              {t("transferAdminDesc")}
            </p>
            <form onSubmit={handleTransferAdmin} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-red-400 mb-3">
                  {t("newAdminAddress")}
                </label>
                <input
                  type="text"
                  placeholder="G..."
                  value={newAdminInput}
                  onChange={(e) => setNewAdminInput(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border-2 border-red-50 dark:border-red-900/30 rounded-2xl px-5 py-4 font-mono text-xs font-bold text-red-900 dark:text-red-200 focus:border-red-500 focus:outline-none transition"
                />
              </div>
              <button
                type="submit"
                disabled={isUpdatingAdmin}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-red-700 active:scale-95 transition shadow-lg shadow-red-500/25 disabled:opacity-50"
              >
                {isUpdatingAdmin ? (txPhaseLabel ?? t("awaitingSignature")) : t("transferAdmin")}
              </button>
            </form>
          </section>

          <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
            <h3 className="text-xl font-bold mb-2">{t("recentActivity")}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
              {t("recentActivityDesc")}
            </p>
            {auditLog.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("noActivity")}</p>
            ) : (
              <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {auditLog.map((entry) => (
                  <li
                    key={`${entry.timestamp}-${entry.txHash}`}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70 p-3"
                  >
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {entry.details ??
                        `${entry.action.replaceAll("_", " ")}${entry.campaignId ? ` #${entry.campaignId}` : ""}`}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                    <a
                      href={explorerTxUrl(entry.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex text-xs font-mono text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {entry.txHash.slice(0, 10)}...{entry.txHash.slice(-8)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Responsibility Footer */}
          <div className="p-8 bg-zinc-50 dark:bg-zinc-950 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3 mb-4 text-zinc-900 dark:text-zinc-100 font-bold">
              <ShieldAlert size={20} className="text-amber-500" />
              {t("responsibility")}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed italic">
              {t("responsibilityText")}
            </p>
          </div>
        </div>
      </div>

      {/* ── Campaign Map ── */}
      <section className="mt-12">
        <CampaignMap campaigns={campaigns} />
      </section>

      {/* ── Two-Factor Authentication ── */}
      {publicKey && (
        <section className="mt-8">
          <AdminTwoFactorSetup adminAddress={publicKey} />
        </section>
      )}

      {/* ── Reports Queue ── */}
      <section className="mt-12">
        <div className="flex items-center justify-between px-2 mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Flag size={22} className="text-red-500" />
            {t("abuseReports")}
            <span className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-300">
              {t("pendingReports", {
                count: reports.filter((r: CampaignReport) => r.status === "pending").length,
              })}
            </span>
          </h2>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          {reports.length === 0 ? (
            <div className="p-16 text-center">
              <Flag size={32} className="mx-auto text-zinc-300 mb-4" />
              <p className="text-zinc-500 font-medium">{t("noReports")}</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className={`p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                    report.status === "reviewed" ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* red-400 on red-900/30 is ~2.6:1; red-300 gives ~4.8:1 — meets WCAG AA */}
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                        {REPORT_REASON_LABELS[report.reason]}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-300">
                        {report.status === "pending" ? t("pending") : t("reviewed")}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Campaign #{report.campaignId}: {report.campaignTitle}
                    </p>
                    {report.notes && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{report.notes}</p>
                    )}
                    <p className="text-xs text-zinc-400">
                      {report.reporterAddress
                        ? t("reportBy", {
                            address: `${report.reporterAddress.slice(0, 8)}...${report.reporterAddress.slice(-6)}`,
                          })
                        : t("anonymous")}
                      {" · "}
                      {new Date(report.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/causes/${report.campaignId}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                    >
                      {t("view")} <ExternalLink size={12} />
                    </Link>
                    {report.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => handleMarkReportReviewed(report.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition"
                      >
                        <CheckCircle size={14} /> {t("reviewed")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <CancelCampaignModal
        isOpen={isRejectModalOpen}
        isCancelling={cancellingId !== null}
        campaignTitle={campaignToReject?.title ?? ""}
        onConfirm={handleConfirmReject}
        onClose={() => setIsRejectModalOpen(false)}
        title={t("reject")}
        confirmLabel={t("reject")}
      />
      <TransferAdminModal
        newAdminAddress={newAdminInput}
        isOpen={isTransferModalOpen}
        isTransferring={isUpdatingAdmin}
        onConfirm={executeTransferAdmin}
        onClose={() => setIsTransferModalOpen(false)}
        title={t("confirmTransferTitle")}
        body={t("confirmTransferBody")}
        confirmLabel={t("typeConfirm")}
        typeConfirmPlaceholder="CONFIRM"
        cancelLabel={t("cancel")}
        confirmButtonLabel={t("confirmTransfer")}
      />
      <TransferAdminModal
        isOpen={isFeeConfirmModalOpen}
        isTransferring={isUpdatingFee}
        onConfirm={handleConfirmFeeUpdate}
        onClose={() => {
          setIsFeeConfirmModalOpen(false);
          setPendingFee(null);
        }}
        title={t("confirmHighFeeTitle")}
        body={t("confirmHighFeeBody")}
        confirmLabel={t("confirmFeeContinue")}
        typeConfirmPlaceholder="CONFIRM"
        cancelLabel={t("cancel")}
        confirmButtonLabel={t("updateFee")}
      />
    </div>
  );
}

function StatsCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-zinc-100 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow group">
      <div
        className="size-12 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
        aria-hidden="true"
      >
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-200 mb-2 block">
        {label}
      </span>
      <span className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{value}</span>
    </div>
  );
}

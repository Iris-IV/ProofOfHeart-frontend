"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock3, Loader2, ShieldCheck } from "lucide-react";
import type { Campaign } from "@/types";
import { useToast } from "@/components/ToastProvider";
import {
  acceptTokenUpdate,
  cancelEmergencyWithdrawal,
  cancelTokenUpdate,
  emergencyWithdraw,
  executeEmergencyWithdrawal,
  getCampaignToken,
  getEmergencyWithdrawal,
  getPlatformToken,
  getTokenUpdateDelaySecs,
  isTokenAllowed,
  proposeTokenUpdate,
  setTokenAllowed,
  type EmergencyWithdrawal,
} from "@/lib/contractClient";
import { parseContractError } from "@/utils/contractErrors";
import { validateStellarAddress } from "@/utils/validators";

const TOKEN_PROPOSAL_KEY = "proof-of-heart.pending-token-update";

interface LocalTokenProposal {
  token: string;
  executeAfter: number;
}

function readLocalProposal(): LocalTokenProposal | null {
  try {
    const stored = window.localStorage.getItem(TOKEN_PROPOSAL_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<LocalTokenProposal>;
    if (typeof parsed.token !== "string" || typeof parsed.executeAfter !== "number") return null;
    return { token: parsed.token, executeAfter: parsed.executeAfter };
  } catch {
    return null;
  }
}

function remaining(seconds: number, now: number): string {
  const total = Math.max(0, seconds - now);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

async function mapInBatches<T, Result>(
  items: T[],
  batchSize: number,
  mapItem: (item: T) => Promise<Result>,
): Promise<Result[]> {
  const results: Result[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    results.push(...(await Promise.all(items.slice(index, index + batchSize).map(mapItem))));
  }
  return results;
}

export default function ContractOperationsSection({
  campaigns,
  adminAddress,
}: {
  campaigns: Campaign[];
  adminAddress: string | null;
}) {
  const t = useTranslations("Admin");
  const tErrors = useTranslations("ContractErrors");
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  const [tokenInput, setTokenInput] = useState("");
  const [replacementToken, setReplacementToken] = useState("");
  const [recipients, setRecipients] = useState<Record<number, string>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [proposal, setProposal] = useState<LocalTokenProposal | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  const { data: platformToken, refetch: refetchPlatformToken } = useQuery({
    queryKey: ["platformToken"],
    queryFn: () => getPlatformToken(true),
  });
  const { data: tokenDelay = 0 } = useQuery({
    queryKey: ["tokenUpdateDelaySecs"],
    queryFn: () => getTokenUpdateDelaySecs(true),
  });
  const campaignIds = useMemo(() => campaigns.map(({ id }) => id), [campaigns]);
  const emergencyCandidates = useMemo(
    () =>
      campaigns.filter(
        (campaign) =>
          !campaign.is_cancelled &&
          !campaign.funds_withdrawn &&
          campaign.amount_raised >= campaign.funding_goal &&
          (campaign.effective_amount_raised ?? campaign.amount_raised) > 0n,
      ),
    [campaigns],
  );
  const { data: tokenUsage = [], isLoading: isTokenUsageLoading } = useQuery({
    queryKey: ["campaignTokenUsage", campaignIds],
    queryFn: async () => {
      const tokens = await mapInBatches(campaigns, 5, async (campaign) => ({
        campaign,
        token: await getCampaignToken(campaign.id),
      }));
      const counts = new Map<string, number>();
      for (const { token } of tokens) {
        if (token) counts.set(token, (counts.get(token) ?? 0) + 1);
      }
      return Promise.all(
        [...counts].map(async ([token, campaignCount]) => ({
          token,
          campaignCount,
          allowed: await isTokenAllowed(token, true),
        })),
      );
    },
    enabled: campaigns.length > 0,
  });
  const { data: emergencyWithdrawals = [], refetch: refetchEmergencyWithdrawals } = useQuery({
    queryKey: ["adminEmergencyWithdrawals", campaignIds],
    queryFn: async () =>
      mapInBatches(emergencyCandidates, 5, async (campaign) => ({
        campaign,
        pending: await getEmergencyWithdrawal(campaign.id, true),
      })),
    enabled: emergencyCandidates.length > 0,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    setProposal(readLocalProposal());
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (proposal && platformToken === proposal.token) {
      window.localStorage.removeItem(TOKEN_PROPOSAL_KEY);
      setProposal(null);
    }
  }, [platformToken, proposal]);

  const localizeError = (error: unknown) => {
    const message = parseContractError(error);
    return message.startsWith("ContractErrors.")
      ? tErrors(message.slice("ContractErrors.".length))
      : message;
  };

  const runAction = async (key: string, action: () => Promise<unknown>, successKey: string) => {
    setBusyAction(key);
    try {
      await action();
      showSuccess(t(`contractOps.${successKey}`));
      await Promise.allSettled([
        refetchPlatformToken(),
        refetchEmergencyWithdrawals(),
        queryClient.invalidateQueries({ queryKey: ["platformReport"] }),
        queryClient.invalidateQueries({ queryKey: ["campaignTokenUsage"] }),
        queryClient.invalidateQueries({ queryKey: ["emergency-withdrawal"] }),
      ]);
    } catch (error) {
      showError(localizeError(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleAllowlist = async (allowed: boolean) => {
    const token = tokenInput.trim();
    try {
      validateStellarAddress(token);
      await runAction(
        `token-${allowed}`,
        async () => {
          await setTokenAllowed(token, allowed);
          setTokenInput("");
        },
        allowed ? "tokenAllowedSuccess" : "tokenRemovedSuccess",
      );
    } catch (error) {
      showError(localizeError(error));
    }
  };

  const handleProposeToken = async () => {
    const token = replacementToken.trim();
    try {
      validateStellarAddress(token);
      if (!(await isTokenAllowed(token, true))) {
        showError(t("contractOps.tokenMustBeAllowed"));
        return;
      }
      await runAction(
        "propose-token",
        async () => {
          await proposeTokenUpdate(token);
          const next = { token, executeAfter: Math.floor(Date.now() / 1000) + tokenDelay };
          window.localStorage.setItem(TOKEN_PROPOSAL_KEY, JSON.stringify(next));
          setProposal(next);
          setReplacementToken("");
        },
        "tokenProposalSuccess",
      );
    } catch (error) {
      showError(localizeError(error));
    }
  };

  const handleTokenUpdate = async (accept: boolean) => {
    await runAction(
      accept ? "accept-token" : "cancel-token",
      async () => {
        if (accept) await acceptTokenUpdate();
        else await cancelTokenUpdate();
        window.localStorage.removeItem(TOKEN_PROPOSAL_KEY);
        setProposal(null);
        await refetchPlatformToken();
      },
      accept ? "tokenAcceptedSuccess" : "tokenCancelledSuccess",
    );
  };

  const tokenReady = !busyAction;
  const tokenRemaining = proposal ? Math.max(0, proposal.executeAfter - now) : 0;

  return (
    <section className="mb-12 space-y-6 rounded-[2rem] border border-amber-200/70 bg-amber-50/50 p-6 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/10 sm:p-8">
      <header>
        <div className="mb-2 flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <ShieldCheck size={18} aria-hidden="true" />
          <h2 className="text-xl font-bold">{t("contractOps.title")}</h2>
        </div>
        <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          {t("contractOps.description")}
        </p>
        {adminAddress && (
          <p className="mt-2 break-all font-mono text-xs text-zinc-500">
            {t("contractOps.connectedAdmin", { address: shortAddress(adminAddress) })}
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-3 font-semibold">{t("contractOps.tokenAllowlist")}</h3>
          <p className="mb-4 break-all text-sm text-zinc-600 dark:text-zinc-400">
            {t("contractOps.currentToken", {
              address: platformToken ? shortAddress(platformToken) : "…",
            })}
          </p>
          <label className="mb-2 block text-sm font-medium" htmlFor="allowlist-token">
            {t("contractOps.tokenAddress")}
          </label>
          <input
            id="allowlist-token"
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder="G…"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!tokenReady || !tokenInput.trim()}
              onClick={() => void handleAllowlist(true)}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busyAction === "token-true" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                t("contractOps.allowToken")
              )}
            </button>
            <button
              type="button"
              disabled={!tokenReady || !tokenInput.trim()}
              onClick={() => void handleAllowlist(false)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-zinc-700"
            >
              {busyAction === "token-false" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                t("contractOps.removeToken")
              )}
            </button>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            {t("contractOps.existingCampaignTokensNote")}
          </p>
          <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <h4 className="mb-2 text-sm font-semibold">{t("contractOps.campaignTokenUsage")}</h4>
            {isTokenUsageLoading ? (
              <p className="text-sm text-zinc-500">{t("contractOps.loadingTokenUsage")}</p>
            ) : tokenUsage.length ? (
              <ul className="space-y-2">
                {tokenUsage.map(({ token, campaignCount, allowed }) => (
                  <li
                    key={token}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="font-mono">{shortAddress(token)}</span>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {t("contractOps.tokenUsageStatus", {
                        count: campaignCount,
                        status: allowed ? t("contractOps.allowed") : t("contractOps.blocked"),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">{t("contractOps.noCampaignTokens")}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-3 font-semibold">{t("contractOps.platformToken")}</h3>
          {proposal ? (
            <div className="space-y-3">
              <p className="break-all text-sm">
                {t("contractOps.proposedToken", { address: shortAddress(proposal.token) })}
              </p>
              <p
                className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300"
                aria-live="polite"
              >
                <Clock3 size={16} aria-hidden="true" />
                {tokenRemaining > 0
                  ? t("contractOps.tokenCountdown", {
                      remaining: remaining(proposal.executeAfter, now),
                    })
                  : t("contractOps.tokenReady")}
              </p>
              <p className="text-xs text-zinc-500">{t("contractOps.localProposalNote")}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!!busyAction || tokenRemaining > 0}
                  onClick={() => void handleTokenUpdate(true)}
                  className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {t("contractOps.acceptToken")}
                </button>
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={() => void handleTokenUpdate(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-zinc-700"
                >
                  {t("contractOps.cancelToken")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                {t("contractOps.tokenDelay", { delay: remaining(tokenDelay, 0) })}
              </p>
              <label className="mb-2 block text-sm font-medium" htmlFor="replacement-token">
                {t("contractOps.newTokenAddress")}
              </label>
              <input
                id="replacement-token"
                value={replacementToken}
                onChange={(event) => setReplacementToken(event.target.value)}
                placeholder="G…"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
              <button
                type="button"
                disabled={!tokenReady || !replacementToken.trim()}
                onClick={() => void handleProposeToken()}
                className="mt-3 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("contractOps.proposeToken")}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-2 font-semibold">{t("contractOps.emergencyTitle")}</h3>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {t("contractOps.emergencyDescription")}
        </p>
        {emergencyWithdrawals.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("contractOps.noCampaigns")}</p>
        ) : (
          <div className="space-y-4">
            {emergencyWithdrawals.map(
              ({
                campaign,
                pending,
              }: {
                campaign: Campaign;
                pending: EmergencyWithdrawal | null;
              }) => {
                const remainingSeconds = pending ? Math.max(0, pending.executeAfter - now) : 0;
                const actionKey = `emergency-${campaign.id}`;
                return (
                  <article
                    key={campaign.id}
                    className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
                  >
                    <h4 className="font-semibold">
                      {campaign.title}{" "}
                      <span className="text-xs font-normal text-zinc-500">#{campaign.id}</span>
                    </h4>
                    {pending ? (
                      <div className="mt-3 space-y-3 text-sm">
                        <p className="break-all">
                          {t("contractOps.pendingRecipient", {
                            address: shortAddress(pending.recipient),
                          })}
                        </p>
                        <p
                          className="flex items-center gap-2 text-amber-700 dark:text-amber-300"
                          aria-live="polite"
                        >
                          {remainingSeconds > 0 ? (
                            <Clock3 size={16} aria-hidden="true" />
                          ) : (
                            <AlertTriangle size={16} aria-hidden="true" />
                          )}
                          {remainingSeconds > 0
                            ? t("contractOps.emergencyCountdown", {
                                remaining: remaining(pending.executeAfter, now),
                              })
                            : t("contractOps.emergencyReady")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!!busyAction || remainingSeconds > 0}
                            onClick={() =>
                              void runAction(
                                `${actionKey}-execute`,
                                () => executeEmergencyWithdrawal(campaign.id),
                                "emergencyExecutedSuccess",
                              )
                            }
                            className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                          >
                            {t("contractOps.executeEmergency")}
                          </button>
                          <button
                            type="button"
                            disabled={!!busyAction}
                            onClick={() =>
                              void runAction(
                                `${actionKey}-cancel`,
                                () => cancelEmergencyWithdrawal(campaign.id),
                                "emergencyCancelledSuccess",
                              )
                            }
                            className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold disabled:opacity-50 dark:border-zinc-700"
                          >
                            {t("contractOps.cancelEmergency")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          value={recipients[campaign.id] ?? ""}
                          onChange={(event) =>
                            setRecipients((current) => ({
                              ...current,
                              [campaign.id]: event.target.value,
                            }))
                          }
                          aria-label={t("contractOps.recipientAddressFor", {
                            title: campaign.title,
                          })}
                          placeholder={t("contractOps.recipientAddress")}
                          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        />
                        <button
                          type="button"
                          disabled={!!busyAction || !recipients[campaign.id]?.trim()}
                          onClick={() => {
                            const recipient = recipients[campaign.id]?.trim() ?? "";
                            try {
                              validateStellarAddress(recipient);
                              void runAction(
                                actionKey,
                                () => emergencyWithdraw(campaign.id, recipient),
                                "emergencyProposedSuccess",
                              );
                            } catch (error) {
                              showError(localizeError(error));
                            }
                          }}
                          className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                        >
                          {t("contractOps.proposeEmergency")}
                        </button>
                      </div>
                    )}
                  </article>
                );
              },
            )}
          </div>
        )}
      </div>
    </section>
  );
}

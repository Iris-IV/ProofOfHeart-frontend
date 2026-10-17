"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/components/WalletContext";
import { useToast } from "@/components/ToastProvider";
import {
  MAX_BOOKMARKS_PER_WALLET,
  batchSaveCampaigns,
  getSavedCampaigns,
  getSavedCampaignsCount,
  removeSavedCampaign,
  saveCampaign,
} from "@/lib/contractClient";
import { ContractError, getContractErrorCode, parseContractError } from "@/utils/contractErrors";

/** localStorage key used while signed out; legacy per-wallet keys are migrated from too. */
const GUEST_KEY = "poh_saved_campaigns_guest";
const WALLET_KEY_PREFIX = "poh_saved_campaigns_";

const savedKey = (publicKey: string | null) => ["savedCampaigns", publicKey] as const;
const countKey = (publicKey: string | null) => ["savedCampaignsCount", publicKey] as const;

function readLocalIds(key: string): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function writeLocalIds(key: string, ids: number[]): void {
  try {
    if (ids.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(ids));
  } catch (e) {
    console.error("Failed to save bookmarks", e);
  }
}

const ALREADY_BOOKMARKED_MESSAGE = "This campaign is already in your saved list.";
const LIMIT_REACHED_MESSAGE = `Your saved list is full (${MAX_BOOKMARKS_PER_WALLET} campaigns). Remove one to save another.`;

/**
 * Contract-client calls rethrow errors as translation keys
 * ("ContractErrors.<Name>"), so match on the code or on that key.
 */
function describeBookmarkError(err: unknown): string {
  const code = getContractErrorCode(err);
  const text = err instanceof Error ? err.message : String(err);
  if (
    code === ContractError.CampaignAlreadyBookmarked ||
    text.includes("CampaignAlreadyBookmarked")
  ) {
    return ALREADY_BOOKMARKED_MESSAGE;
  }
  if (code === ContractError.BookmarkLimitReached || text.includes("BookmarkLimitReached")) {
    return LIMIT_REACHED_MESSAGE;
  }
  return parseContractError(err);
}

/**
 * Saved campaigns (#1674). With a wallet connected the list lives on-chain
 * (`get_saved_campaigns` / `save_campaign` / `remove_saved_campaign`) and
 * toggles are applied optimistically through React Query, rolling back if the
 * transaction fails. Signed out, bookmarks fall back to localStorage; those
 * (plus any pre-migration per-wallet entries) can be pushed to the wallet in a
 * single `batch_save_campaigns` transaction via `syncLocalBookmarks`.
 */
export function useSavedCampaigns() {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  // Toasts are optional: the hook also runs in trees without a ToastProvider.
  let toast: ReturnType<typeof useToast> | undefined;
  try {
    toast = useToast();
  } catch {
    toast = undefined;
  }
  const [guestIds, setGuestIds] = useState<number[]>([]);
  const [legacyIds, setLegacyIds] = useState<number[]>([]);

  useEffect(() => {
    setGuestIds(readLocalIds(GUEST_KEY));
    setLegacyIds(publicKey ? readLocalIds(`${WALLET_KEY_PREFIX}${publicKey}`) : []);
  }, [publicKey]);

  const { data: chainIds } = useQuery({
    queryKey: savedKey(publicKey),
    queryFn: () => getSavedCampaigns(publicKey as string),
    enabled: !!publicKey,
    staleTime: 30_000,
  });

  const savedIds = publicKey ? (chainIds ?? []) : guestIds;

  const toggleMutation = useMutation({
    mutationFn: async ({ campaignId, save }: { campaignId: number; save: boolean }) => {
      const wallet = publicKey as string;
      return save ? saveCampaign(wallet, campaignId) : removeSavedCampaign(wallet, campaignId);
    },
    onMutate: async ({ campaignId, save }) => {
      await queryClient.cancelQueries({ queryKey: savedKey(publicKey) });
      const previous = queryClient.getQueryData<number[]>(savedKey(publicKey)) ?? [];
      const next = save
        ? [...previous.filter((id) => id !== campaignId), campaignId]
        : previous.filter((id) => id !== campaignId);
      queryClient.setQueryData(savedKey(publicKey), next);
      return { previous };
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(savedKey(publicKey), context?.previous ?? []);
      toast?.showError(describeBookmarkError(err));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: savedKey(publicKey) });
      void queryClient.invalidateQueries({ queryKey: countKey(publicKey) });
    },
  });

  const isSaved = useCallback((campaignId: number) => savedIds.includes(campaignId), [savedIds]);

  const toggleSaved = useCallback(
    (campaignId: number) => {
      if (!publicKey) {
        setGuestIds((prev) => {
          const next = prev.includes(campaignId)
            ? prev.filter((id) => id !== campaignId)
            : [...prev, campaignId];
          writeLocalIds(GUEST_KEY, next);
          return next;
        });
        return;
      }

      const current = queryClient.getQueryData<number[]>(savedKey(publicKey)) ?? chainIds ?? [];
      const save = !current.includes(campaignId);
      if (save && current.length >= MAX_BOOKMARKS_PER_WALLET) {
        toast?.showError(describeBookmarkError(new Error("Error(Contract, #47)")));
        return;
      }
      toggleMutation.mutate({ campaignId, save });
    },
    [publicKey, queryClient, chainIds, toast, toggleMutation],
  );

  // Local bookmarks that are not on-chain yet (signed-out saves + legacy per-wallet entries).
  // Hidden until the on-chain list has loaded so capacity and duplicates are known.
  const localBookmarks =
    publicKey && chainIds
      ? Array.from(new Set([...guestIds, ...legacyIds])).filter((id) => !chainIds.includes(id))
      : [];

  const syncMutation = useMutation({
    mutationFn: async () => {
      const wallet = publicKey as string;
      const onChain = chainIds ?? [];
      const capacity = Math.max(0, MAX_BOOKMARKS_PER_WALLET - onChain.length);
      const toSync = localBookmarks.slice(0, capacity);
      if (toSync.length === 0) throw new Error("Error(Contract, #47)");
      await batchSaveCampaigns(wallet, toSync);
      return toSync;
    },
    onSuccess: (synced) => {
      const remaining = (ids: number[]) => ids.filter((id) => !synced.includes(id));
      const nextGuest = remaining(guestIds);
      const nextLegacy = remaining(legacyIds);
      writeLocalIds(GUEST_KEY, nextGuest);
      if (publicKey) writeLocalIds(`${WALLET_KEY_PREFIX}${publicKey}`, nextLegacy);
      setGuestIds(nextGuest);
      setLegacyIds(nextLegacy);
      toast?.showSuccess(
        `Synced ${synced.length} bookmark${synced.length === 1 ? "" : "s"} to your wallet.`,
      );
    },
    onError: (err) => toast?.showError(describeBookmarkError(err)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: savedKey(publicKey) });
      void queryClient.invalidateQueries({ queryKey: countKey(publicKey) });
    },
  });

  return {
    savedIds,
    toggleSaved,
    isSaved,
    /** Local-only bookmarks waiting to be moved on-chain (empty while signed out). */
    localBookmarks,
    syncLocalBookmarks: () => syncMutation.mutate(),
    isSyncing: syncMutation.isPending,
  };
}

/** Saved-campaign count for the navbar badge, straight from `get_saved_campaigns_count`. */
export function useSavedCampaignsCount(): number {
  const { publicKey } = useWallet();
  const { data } = useQuery({
    queryKey: countKey(publicKey),
    queryFn: () => getSavedCampaignsCount(publicKey as string),
    enabled: !!publicKey,
    staleTime: 30_000,
  });
  return publicKey ? (data ?? 0) : 0;
}

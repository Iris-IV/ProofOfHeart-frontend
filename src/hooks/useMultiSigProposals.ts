"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "poh_multisig_proposals";

export interface MultiSigSigner {
  address: string;
  signedAt?: number;
}

export interface MultiSigProposal {
  id: string;
  campaignId: number;
  proposedBy: string;
  createdAt: number;
  signers: MultiSigSigner[];
  requiredSignatures: number;
  status: "pending" | "ready" | "executed" | "cancelled";
  txHash?: string;
}

function loadAll(): MultiSigProposal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MultiSigProposal[]) : [];
  } catch {
    return [];
  }
}

function persistAll(proposals: MultiSigProposal[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(proposals));
}

export function useMultiSigProposals(campaignId: number, walletAddress: string | null) {
  const [proposals, setProposals] = useState<MultiSigProposal[]>([]);

  useEffect(() => {
    setProposals(loadAll().filter((p) => p.campaignId === campaignId));
  }, [campaignId]);

  const updateCampaignProposals = useCallback(
    (next: MultiSigProposal[]) => {
      const others = loadAll().filter((p) => p.campaignId !== campaignId);
      persistAll([...others, ...next]);
      setProposals(next);
    },
    [campaignId],
  );

  const createProposal = useCallback(
    (signerAddresses: string[], requiredSignatures: number) => {
      if (!walletAddress) return;
      const existing = proposals.filter((p) => p.status === "pending" || p.status === "ready");
      if (existing.length > 0) return;
      const proposal: MultiSigProposal = {
        id: `${campaignId}-${Date.now()}`,
        campaignId,
        proposedBy: walletAddress,
        createdAt: Math.floor(Date.now() / 1000),
        signers: signerAddresses.map((address) => ({ address })),
        requiredSignatures,
        status: "pending",
      };
      updateCampaignProposals([...proposals, proposal]);
    },
    [campaignId, walletAddress, proposals, updateCampaignProposals],
  );

  const signProposal = useCallback(
    (proposalId: string) => {
      if (!walletAddress) return;
      const updated = proposals.map((p) => {
        if (p.id !== proposalId) return p;
        const signers = p.signers.map((s) =>
          s.address.toLowerCase() === walletAddress.toLowerCase() && !s.signedAt
            ? { ...s, signedAt: Math.floor(Date.now() / 1000) }
            : s,
        );
        const signedCount = signers.filter((s) => !!s.signedAt).length;
        const status: MultiSigProposal["status"] =
          signedCount >= p.requiredSignatures ? "ready" : "pending";
        return { ...p, signers, status };
      });
      updateCampaignProposals(updated);
    },
    [walletAddress, proposals, updateCampaignProposals],
  );

  const cancelProposal = useCallback(
    (proposalId: string) => {
      const updated = proposals.map((p) =>
        p.id === proposalId ? { ...p, status: "cancelled" as const } : p,
      );
      updateCampaignProposals(updated);
    },
    [proposals, updateCampaignProposals],
  );

  const markExecuted = useCallback(
    (proposalId: string, txHash: string) => {
      const updated = proposals.map((p) =>
        p.id === proposalId ? { ...p, status: "executed" as const, txHash } : p,
      );
      updateCampaignProposals(updated);
    },
    [proposals, updateCampaignProposals],
  );

  const activeProposal =
    proposals.find((p) => p.status === "pending" || p.status === "ready") ?? null;

  return {
    proposals,
    activeProposal,
    createProposal,
    signProposal,
    cancelProposal,
    markExecuted,
  };
}

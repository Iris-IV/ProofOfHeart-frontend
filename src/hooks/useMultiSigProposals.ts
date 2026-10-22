"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  multiSigAggregator,
  type MultiSigAggregator,
  type MultiSigAggregatorState,
  type MultiSigSignature,
} from "@/lib/multiSigAggregator";

/**
 * - `awaiting`: no signature collected yet.
 * - `collecting`: some, but fewer than the threshold.
 * - `ready`: threshold met — the transaction can be aggregated and submitted.
 */
export type MultiSigProposalStatus = "awaiting" | "collecting" | "ready";

export interface MultiSigProposal {
  campaignId: number;
  requiredSignatures: number;
  signatures: MultiSigSignature[];
  signedCount: number;
  /** Signatures still needed to reach the threshold (never negative). */
  remaining: number;
  /** Threshold progress, 0–100. */
  progressPct: number;
  status: MultiSigProposalStatus;
  /** Timestamp (ms) of the most recent signature, or null when none. */
  lastSignedAt: number | null;
}

export interface UseMultiSigProposalsResult {
  /** Ready proposals first, then collecting, then awaiting; by campaign id within each. */
  proposals: MultiSigProposal[];
  pendingCount: number;
  readyCount: number;
}

const STATUS_ORDER: Record<MultiSigProposalStatus, number> = {
  ready: 0,
  collecting: 1,
  awaiting: 2,
};

/** Derives the dashboard view model for one aggregator session. */
export function toMultiSigProposal(state: MultiSigAggregatorState): MultiSigProposal {
  const signedCount = state.collectedSignatures.length;
  const required = Math.max(0, state.requiredSignatures);
  const status: MultiSigProposalStatus = state.isComplete
    ? "ready"
    : signedCount === 0
      ? "awaiting"
      : "collecting";
  // Mirrors the aggregator: only a complete session counts as 100%.
  const progressPct = state.isComplete
    ? 100
    : required === 0
      ? 0
      : Math.min(99, Math.round((signedCount / required) * 100));

  return {
    campaignId: state.campaignId,
    requiredSignatures: required,
    signatures: state.collectedSignatures,
    signedCount,
    remaining: Math.max(0, required - signedCount),
    progressPct,
    status,
    lastSignedAt:
      signedCount > 0 ? Math.max(...state.collectedSignatures.map((s) => s.timestamp)) : null,
  };
}

/**
 * Live view of the multi-sig cancellation sessions held by `MultiSigAggregator`.
 * Re-renders whenever a session is initiated, signed or cleared.
 */
export function useMultiSigProposals(
  aggregator: MultiSigAggregator = multiSigAggregator,
): UseMultiSigProposalsResult {
  const sessions = useSyncExternalStore(
    (listener) => aggregator.subscribe(listener),
    () => aggregator.getSnapshot(),
    () => aggregator.getSnapshot(),
  );

  return useMemo(() => {
    const proposals = sessions
      .map(toMultiSigProposal)
      .sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.campaignId - b.campaignId,
      );
    const readyCount = proposals.filter((p) => p.status === "ready").length;
    return { proposals, readyCount, pendingCount: proposals.length - readyCount };
  }, [sessions]);
}

"use client";

import { hasOffchainApiBaseUrl, requestOffchainJson } from "./offchainApiClient";

export type ReportReason = "scam" | "inappropriate" | "misleading" | "duplicate" | "other";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  scam: "Scam / Fraud",
  inappropriate: "Inappropriate Content",
  misleading: "Misleading Information",
  duplicate: "Duplicate Campaign",
  other: "Other",
};

export interface CampaignReport {
  id: string;
  campaignId: number;
  campaignTitle: string;
  reason: ReportReason;
  notes: string;
  reporterAddress: string | null;
  timestamp: number;
  status: "pending" | "reviewed";
}

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

// ---------------------------------------------------------------------------
// Backend API functions
// ---------------------------------------------------------------------------

export async function submitReport(
  campaignId: number,
  campaignTitle: string,
  reason: ReportReason,
  notes: string,
  reporterAddress: string | null,
): Promise<CampaignReport> {
  if (USE_MOCKS || !hasOffchainApiBaseUrl()) {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      campaignId,
      campaignTitle,
      reason,
      notes,
      reporterAddress,
      timestamp: Date.now(),
      status: "pending",
    };
  }

  return requestOffchainJson<CampaignReport>("/campaign-reports", {
    method: "POST",
    auth: {
      purpose: "submit_campaign_report",
      payload: { campaignId, campaignTitle, reason, notes, reporterAddress },
    },
    body: { campaignId, campaignTitle, reason, notes, reporterAddress },
  });
}

export async function getAllReports(): Promise<CampaignReport[]> {
  if (USE_MOCKS || !hasOffchainApiBaseUrl()) return [];
  return requestOffchainJson<CampaignReport[]>("/campaign-reports");
}

export async function getPendingReports(): Promise<CampaignReport[]> {
  if (USE_MOCKS || !hasOffchainApiBaseUrl()) return [];
  return requestOffchainJson<CampaignReport[]>("/campaign-reports?status=pending");
}

export async function markReportReviewed(id: string): Promise<CampaignReport> {
  if (USE_MOCKS || !hasOffchainApiBaseUrl()) {
    return {
      id,
      campaignId: 0,
      campaignTitle: "",
      reason: "other",
      notes: "",
      reporterAddress: null,
      timestamp: 0,
      status: "reviewed",
    };
  }

  return requestOffchainJson<CampaignReport>(`/campaign-reports/${id}`, {
    method: "PATCH",
    auth: {
      purpose: "review_campaign_report",
      payload: { id, status: "reviewed" },
    },
    body: { status: "reviewed" },
  });
}

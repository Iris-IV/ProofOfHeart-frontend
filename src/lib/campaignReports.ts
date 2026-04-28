'use client';

export type ReportReason =
  | 'scam'
  | 'inappropriate'
  | 'misleading'
  | 'duplicate'
  | 'other';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  scam: 'Scam / Fraud',
  inappropriate: 'Inappropriate Content',
  misleading: 'Misleading Information',
  duplicate: 'Duplicate Campaign',
  other: 'Other',
};

export interface CampaignReport {
  id: string;
  campaignId: number;
  campaignTitle: string;
  reason: ReportReason;
  notes: string;
  reporterAddress: string | null;
  timestamp: number;
  status: 'pending' | 'reviewed';
}

const STORAGE_KEY = 'proof_of_heart_reports_v1';

function canUseStorage(): boolean {
  return typeof window !== 'undefined';
}

function readAll(): CampaignReport[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(reports: CampaignReport[]): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // ignore
  }
}

export function submitReport(
  campaignId: number,
  campaignTitle: string,
  reason: ReportReason,
  notes: string,
  reporterAddress: string | null,
): CampaignReport {
  const report: CampaignReport = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    campaignId,
    campaignTitle,
    reason,
    notes,
    reporterAddress,
    timestamp: Date.now(),
    status: 'pending',
  };
  const all = readAll();
  all.push(report);
  writeAll(all);
  return report;
}

export function getAllReports(): CampaignReport[] {
  return readAll().sort((a, b) => b.timestamp - a.timestamp);
}

export function getPendingReports(): CampaignReport[] {
  return getAllReports().filter((r) => r.status === 'pending');
}

export function markReportReviewed(id: string): void {
  const all = readAll().map((r) => (r.id === id ? { ...r, status: 'reviewed' as const } : r));
  writeAll(all);
}

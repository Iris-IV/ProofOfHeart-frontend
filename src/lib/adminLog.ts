import { normalizeAddress } from "./stellar";

export type AdminAuditAction =
  | "verify_campaign"
  | "reject_campaign"
  | "update_platform_fee"
  | "transfer_admin";

export interface AdminAuditLogEntry {
  adminAddress: string;
  action: AdminAuditAction;
  txHash: string;
  timestamp: number;
  campaignId?: number;
  details?: string;
}

const STORAGE_KEY = "proof_of_heart_admin_audit_log_v1";
const MAX_ENTRIES = 500;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readAllEntries(): AdminAuditLogEntry[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AdminAuditLogEntry[];
  } catch {
    return [];
  }
}

function writeAllEntries(entries: AdminAuditLogEntry[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Ignore localStorage write failures.
  }
}

export function appendAdminAuditLog(
  entry: Omit<AdminAuditLogEntry, "timestamp" | "adminAddress"> & {
    adminAddress: string;
  },
): void {
  const allEntries = readAllEntries();
  allEntries.push({
    ...entry,
    adminAddress: normalizeAddress(entry.adminAddress),
    timestamp: Date.now(),
  });
  writeAllEntries(allEntries);
}

export function getAdminAuditLog(adminAddress: string, limit = 50): AdminAuditLogEntry[] {
  const normalizedAddress = normalizeAddress(adminAddress);
  return readAllEntries()
    .filter((entry) => normalizeAddress(entry.adminAddress) === normalizedAddress)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, Math.max(0, limit));
}

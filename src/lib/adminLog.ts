import {
  ADMIN_ADDRESS_HEADER,
  ADMIN_SIGNATURE_HEADER,
  ADMIN_TIMESTAMP_HEADER,
  buildAdminChallenge,
} from "./adminAuth";
import { normalizeAddress } from "./stellar";
import {
  readAllEntries,
  writeAllEntries,
  appendTimestamp,
  filterAndSortByTimestamp,
} from "./logUtil";
import { signWalletMessage } from "./walletSigner";

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
const API_ENDPOINT = "/api/admin-audit-log";

/**
 * A signed challenge is reused for a short spell so a run of admin actions does
 * not put a wallet prompt in front of the user for every request. Kept well
 * inside the freshness window the route enforces.
 */
const CHALLENGE_REUSE_MS = 60_000;

const headerCache = new Map<string, { headers: Record<string, string>; timestamp: number }>();

/**
 * Proves to the API route that the caller controls `adminAddress` by signing a
 * challenge bound to this exact request. The route rejects anything unsigned,
 * so these headers are mandatory rather than best-effort.
 */
async function adminAuthHeaders(
  adminAddress: string,
  method: string,
): Promise<Record<string, string>> {
  const cacheKey = `${normalizeAddress(adminAddress)}:${method}`;
  const cached = headerCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CHALLENGE_REUSE_MS) {
    return cached.headers;
  }

  const timestamp = Date.now();
  const signature = await signWalletMessage(
    buildAdminChallenge({ address: adminAddress, method, path: API_ENDPOINT, timestamp }),
  );

  const headers = {
    [ADMIN_ADDRESS_HEADER]: adminAddress,
    [ADMIN_TIMESTAMP_HEADER]: String(timestamp),
    [ADMIN_SIGNATURE_HEADER]: signature,
  };

  headerCache.set(cacheKey, { headers, timestamp });
  return headers;
}

async function readApiEntries(adminAddress: string): Promise<AdminAuditLogEntry[]> {
  const url = new URL(API_ENDPOINT, window.location.origin);
  url.searchParams.set("adminAddress", adminAddress);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(await adminAuthHeaders(adminAddress, "GET")),
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch admin audit log.");
  }

  const payload = (await response.json()) as { entries?: AdminAuditLogEntry[] };
  return Array.isArray(payload.entries) ? payload.entries : [];
}

async function persistApiEntry(entry: AdminAuditLogEntry): Promise<void> {
  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await adminAuthHeaders(entry.adminAddress, "POST")),
    },
    body: JSON.stringify(entry),
  });

  if (!response.ok) {
    throw new Error("Failed to persist admin audit log entry.");
  }
}

export async function appendAdminAuditLog(
  entry: Omit<AdminAuditLogEntry, "timestamp" | "adminAddress"> & {
    adminAddress: string;
  },
): Promise<void> {
  const nextEntry = appendTimestamp<AdminAuditLogEntry>({
    ...entry,
    adminAddress: normalizeAddress(entry.adminAddress),
  });

  try {
    await persistApiEntry(nextEntry);
    writeAllEntries(
      STORAGE_KEY,
      [...readAllEntries<AdminAuditLogEntry>(STORAGE_KEY), nextEntry],
      MAX_ENTRIES,
    );
    return;
  } catch {
    const allEntries = readAllEntries<AdminAuditLogEntry>(STORAGE_KEY);
    allEntries.push(nextEntry);
    writeAllEntries(STORAGE_KEY, allEntries, MAX_ENTRIES);
  }
}

export async function getAdminAuditLog(
  adminAddress: string,
  limit = 50,
): Promise<AdminAuditLogEntry[]> {
  const normalizedAddress = normalizeAddress(adminAddress);

  try {
    const apiEntries = await readApiEntries(normalizedAddress);
    if (apiEntries.length > 0) {
      writeAllEntries(STORAGE_KEY, apiEntries, MAX_ENTRIES);
      return apiEntries.sort((a, b) => b.timestamp - a.timestamp).slice(0, Math.max(0, limit));
    }
  } catch {
    // Fall back to local cache below.
  }

  return filterAndSortByTimestamp(
    readAllEntries<AdminAuditLogEntry>(STORAGE_KEY),
    "adminAddress",
    normalizedAddress,
    limit,
  );
}

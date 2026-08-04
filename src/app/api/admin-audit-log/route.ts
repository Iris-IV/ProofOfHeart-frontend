import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AdminAuditAction =
  | "verify_campaign"
  | "reject_campaign"
  | "update_platform_fee"
  | "transfer_admin";

interface AdminAuditLogEntry {
  adminAddress: string;
  action: AdminAuditAction;
  txHash: string;
  timestamp: number;
  campaignId?: number;
  details?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "admin-audit-log.json");

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf8");
  }
}

async function readEntries(): Promise<AdminAuditLogEntry[]> {
  await ensureStore();
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdminAuditLogEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeEntries(entries: AdminAuditLogEntry[]): Promise<void> {
  await ensureStore();
  await fs.writeFile(DATA_FILE, JSON.stringify(entries.slice(-500), null, 2), "utf8");
}

function normalizeAddress(address: string): string {
  return address.trim().toUpperCase();
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePageSize(raw: string | null): number {
  const parsed = parseInt(raw ?? String(DEFAULT_PAGE_SIZE), 10);
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Number.isFinite(parsed) ? parsed : DEFAULT_PAGE_SIZE));
}

function parsePage(raw: string | null): number {
  const parsed = parseInt(raw ?? "1", 10);
  return Math.max(1, Number.isFinite(parsed) ? parsed : 1);
}

function pickFields<T>(item: T, fields: string[]): Partial<T> {
  const picked: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in item) {
      picked[field] = (item as Record<string, unknown>)[field];
    }
  }
  return picked as Partial<T>;
}

// GET /api/admin-audit-log?page=1&pageSize=20&adminAddress=...&action=...&fields=...
export async function GET(request: Request) {
  const url = new URL(request.url);
  const adminAddress = url.searchParams.get("adminAddress");
  const action = url.searchParams.get("action");
  const page = parsePage(url.searchParams.get("page"));
  const pageSize = parsePageSize(url.searchParams.get("pageSize"));
  const fields = url.searchParams.get("fields");
  const requestedFields = fields ? fields.split(",").map((f) => f.trim()).filter(Boolean) : [];

  let entries = await readEntries();

  if (adminAddress) {
    const normalized = normalizeAddress(adminAddress);
    entries = entries.filter((entry) => normalizeAddress(entry.adminAddress) === normalized);
  }

  if (action) {
    entries = entries.filter((entry) => entry.action === action);
  }

  entries.sort((a, b) => b.timestamp - a.timestamp);
  const total = entries.length;
  const start = (page - 1) * pageSize;
  const pageEntries = entries.slice(start, start + pageSize).map((entry) =>
    requestedFields.length > 0 ? pickFields(entry, requestedFields) : entry,
  );

  return NextResponse.json({ entries: pageEntries, total, page, pageSize, hasMore: page * pageSize < total });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<AdminAuditLogEntry>;
  if (!body.adminAddress || !body.action || !body.txHash) {
    return NextResponse.json({ error: "Invalid audit entry." }, { status: 400 });
  }

  const nextEntry: AdminAuditLogEntry = {
    adminAddress: normalizeAddress(body.adminAddress),
    action: body.action,
    txHash: body.txHash,
    timestamp: typeof body.timestamp === "number" ? body.timestamp : Date.now(),
    campaignId: body.campaignId,
    details: body.details,
  };

  const entries = await readEntries();
  entries.push(nextEntry);
  await writeEntries(entries);

  return NextResponse.json({ entry: nextEntry }, { status: 201 });
}

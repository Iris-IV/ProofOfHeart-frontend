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

async function verifyIsAdmin(callerAddress: string | null): Promise<boolean> {
  if (!callerAddress) return false;
  try {
    const adminFromEnv = process.env.PLATFORM_ADMIN_ADDRESS?.trim();
    if (adminFromEnv && normalizeAddress(callerAddress) === normalizeAddress(adminFromEnv)) return true;
    const { getAdmin } = await import("@/lib/contractClient");
    const onChainAdmin = await getAdmin().catch(() => null);
    if (onChainAdmin && normalizeAddress(callerAddress) === normalizeAddress(onChainAdmin)) return true;
  } catch {}
  return false;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const adminAddress = url.searchParams.get("adminAddress");
  const callerAddress = request.headers.get("x-admin-address") || adminAddress;

  const isAdmin = await verifyIsAdmin(callerAddress);
  if (!isAdmin) {
    return NextResponse.json({ error: "Not authorized — admin only" }, { status: 403 });
  }

  const entries = await readEntries();

  if (!adminAddress) {
    return NextResponse.json({ entries });
  }

  const normalized = normalizeAddress(adminAddress);
  return NextResponse.json({
    entries: entries
      .filter((entry) => normalizeAddress(entry.adminAddress) === normalized)
      .sort((a, b) => b.timestamp - a.timestamp),
  });
}

export async function POST(request: Request) {
  const callerAddress = request.headers.get("x-admin-address");
  if (!(await verifyIsAdmin(callerAddress))) {
    return NextResponse.json({ error: "Not authorized — admin only" }, { status: 403 });
  }
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

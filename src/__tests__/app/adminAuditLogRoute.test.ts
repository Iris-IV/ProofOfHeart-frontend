/**
 * @jest-environment node
 */

/**
 * #567 — the audit trail must not leave the server without proof that the
 * caller is the platform admin.
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import {
  ADMIN_ADDRESS_HEADER,
  ADMIN_SIGNATURE_HEADER,
  ADMIN_TIMESTAMP_HEADER,
  buildAdminChallenge,
} from "@/lib/adminAuth";

const ADMIN = StellarSdk.Keypair.random();
const IMPOSTOR = StellarSdk.Keypair.random();
const PATH = "/api/admin-audit-log";

const STORED_ENTRIES = [
  {
    adminAddress: ADMIN.publicKey(),
    action: "verify_campaign",
    txHash: "abc123",
    timestamp: 1_700_000_000_000,
    campaignId: 1,
  },
];

// Keep the audit store in memory — the route otherwise writes into ./data.
let fileContents = JSON.stringify(STORED_ENTRIES);

jest.mock("fs", () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockImplementation(async () => fileContents),
    writeFile: jest.fn().mockImplementation(async (_path: string, data: string) => {
      fileContents = data;
    }),
  },
}));

jest.mock("@/lib/server/platformAdmin", () => ({
  getPlatformAdminAddress: jest.fn().mockImplementation(async () => ADMIN.publicKey()),
}));

import { GET, POST } from "@/app/api/admin-audit-log/route";

function authHeaders(keypair: StellarSdk.Keypair, method: string): Record<string, string> {
  const timestamp = Date.now();
  const address = keypair.publicKey();
  const challenge = buildAdminChallenge({ address, method, path: PATH, timestamp });

  return {
    [ADMIN_ADDRESS_HEADER]: address,
    [ADMIN_TIMESTAMP_HEADER]: String(timestamp),
    [ADMIN_SIGNATURE_HEADER]: keypair.sign(Buffer.from(challenge, "utf8")).toString("base64"),
  };
}

function request(method: string, headers: Record<string, string>, body?: unknown): Request {
  return new Request(`https://poh.test${PATH}`, {
    method,
    headers: body ? { ...headers, "Content-Type": "application/json" } : headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/admin-audit-log", () => {
  beforeEach(() => {
    fileContents = JSON.stringify(STORED_ENTRIES);
  });

  it("GET refuses an unauthenticated caller and leaks no entries", async () => {
    const response = await GET(request("GET", {}));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.not.toHaveProperty("entries");
  });

  it("GET refuses a caller who is not the platform admin", async () => {
    const response = await GET(request("GET", authHeaders(IMPOSTOR, "GET")));

    expect(response.status).toBe(403);
  });

  it("GET returns the trail to the platform admin", async () => {
    const response = await GET(request("GET", authHeaders(ADMIN, "GET")));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ entries: STORED_ENTRIES });
  });

  it("POST refuses an unauthenticated writer and stores nothing", async () => {
    const response = await POST(
      request(
        "POST",
        {},
        { adminAddress: ADMIN.publicKey(), action: "verify_campaign", txHash: "x" },
      ),
    );

    expect(response.status).toBe(401);
    expect(JSON.parse(fileContents)).toHaveLength(1);
  });

  it("POST refuses to record an entry attributed to someone else", async () => {
    const response = await POST(
      request("POST", authHeaders(ADMIN, "POST"), {
        adminAddress: IMPOSTOR.publicKey(),
        action: "transfer_admin",
        txHash: "spoofed",
      }),
    );

    expect(response.status).toBe(403);
    expect(JSON.parse(fileContents)).toHaveLength(1);
  });

  it("POST records an entry for the authenticated admin", async () => {
    const response = await POST(
      request("POST", authHeaders(ADMIN, "POST"), {
        adminAddress: ADMIN.publicKey(),
        action: "update_platform_fee",
        txHash: "def456",
        details: "300 bps",
      }),
    );

    expect(response.status).toBe(201);
    const stored = JSON.parse(fileContents);
    expect(stored).toHaveLength(2);
    expect(stored[1]).toMatchObject({
      adminAddress: ADMIN.publicKey().toUpperCase(),
      action: "update_platform_fee",
      txHash: "def456",
    });
  });
});

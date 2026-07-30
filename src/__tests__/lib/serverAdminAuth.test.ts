/**
 * @jest-environment node
 */

/**
 * #567 — /api/admin-audit-log used to hand the admin trail to anyone who asked.
 * The gate below is what stands in the way now, so these cases pin down every
 * way a request can fail to get through it.
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import {
  ADMIN_ADDRESS_HEADER,
  ADMIN_SIGNATURE_HEADER,
  ADMIN_TIMESTAMP_HEADER,
  buildAdminChallenge,
} from "@/lib/adminAuth";

const mockGetPlatformAdminAddress = jest.fn();

jest.mock("@/lib/server/platformAdmin", () => ({
  getPlatformAdminAddress: () => mockGetPlatformAdminAddress(),
}));

import { requirePlatformAdmin } from "@/lib/server/adminAuth";

const ADMIN = StellarSdk.Keypair.random();
const IMPOSTOR = StellarSdk.Keypair.random();
const URL_UNDER_TEST = "https://poh.test/api/admin-audit-log";

function sign(keypair: StellarSdk.Keypair, challenge: string): string {
  return keypair.sign(Buffer.from(challenge, "utf8")).toString("base64");
}

function makeRequest(
  headers: Record<string, string>,
  { method = "GET", url = URL_UNDER_TEST }: { method?: string; url?: string } = {},
): Request {
  return new Request(url, { method, headers });
}

function signedHeaders(
  keypair: StellarSdk.Keypair,
  {
    method = "GET",
    path = "/api/admin-audit-log",
    timestamp = Date.now(),
    address = keypair.publicKey(),
  } = {},
): Record<string, string> {
  return {
    [ADMIN_ADDRESS_HEADER]: address,
    [ADMIN_TIMESTAMP_HEADER]: String(timestamp),
    [ADMIN_SIGNATURE_HEADER]: sign(
      keypair,
      buildAdminChallenge({ address, method, path, timestamp }),
    ),
  };
}

describe("requirePlatformAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPlatformAdminAddress.mockResolvedValue(ADMIN.publicKey());
  });

  it("admits the platform admin with a valid signature", async () => {
    const result = await requirePlatformAdmin(makeRequest(signedHeaders(ADMIN)));

    expect(result).toEqual({ ok: true, address: ADMIN.publicKey() });
  });

  it("rejects an unauthenticated request with 401", async () => {
    const result = await requirePlatformAdmin(makeRequest({}));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("rejects a claimed admin address with no signature", async () => {
    // The admin address is public — readable from the contract — so asserting
    // it must not be enough on its own.
    const result = await requirePlatformAdmin(
      makeRequest({
        [ADMIN_ADDRESS_HEADER]: ADMIN.publicKey(),
        [ADMIN_TIMESTAMP_HEADER]: String(Date.now()),
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("rejects a signature made by a different key", async () => {
    const timestamp = Date.now();
    const challenge = buildAdminChallenge({
      address: ADMIN.publicKey(),
      method: "GET",
      path: "/api/admin-audit-log",
      timestamp,
    });

    const result = await requirePlatformAdmin(
      makeRequest({
        [ADMIN_ADDRESS_HEADER]: ADMIN.publicKey(),
        [ADMIN_TIMESTAMP_HEADER]: String(timestamp),
        [ADMIN_SIGNATURE_HEADER]: sign(IMPOSTOR, challenge),
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("rejects a stale challenge", async () => {
    const result = await requirePlatformAdmin(
      makeRequest(signedHeaders(ADMIN, { timestamp: Date.now() - 10 * 60_000 })),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("rejects a challenge signed for a different method", async () => {
    const headers = signedHeaders(ADMIN, { method: "GET" });

    const result = await requirePlatformAdmin(makeRequest(headers, { method: "POST" }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("rejects a challenge signed for a different path", async () => {
    const headers = signedHeaders(ADMIN, { path: "/api/something-else" });

    const result = await requirePlatformAdmin(makeRequest(headers));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("rejects a correctly signed request from a non-admin with 403", async () => {
    const result = await requirePlatformAdmin(makeRequest(signedHeaders(IMPOSTOR)));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("denies rather than admits when the admin address cannot be resolved", async () => {
    mockGetPlatformAdminAddress.mockRejectedValue(new Error("RPC unreachable"));

    const result = await requirePlatformAdmin(makeRequest(signedHeaders(ADMIN)));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(503);
  });

  it("accepts a signature over the hashed challenge, as Freighter produces", async () => {
    const timestamp = Date.now();
    const challenge = buildAdminChallenge({
      address: ADMIN.publicKey(),
      method: "GET",
      path: "/api/admin-audit-log",
      timestamp,
    });
    const hashed = StellarSdk.hash(Buffer.from(challenge, "utf8"));

    const result = await requirePlatformAdmin(
      makeRequest({
        [ADMIN_ADDRESS_HEADER]: ADMIN.publicKey(),
        [ADMIN_TIMESTAMP_HEADER]: String(timestamp),
        [ADMIN_SIGNATURE_HEADER]: ADMIN.sign(hashed).toString("base64"),
      }),
    );

    expect(result).toEqual({ ok: true, address: ADMIN.publicKey() });
  });

  it("matches the admin address regardless of header casing", async () => {
    mockGetPlatformAdminAddress.mockResolvedValue(ADMIN.publicKey().toLowerCase());

    const result = await requirePlatformAdmin(makeRequest(signedHeaders(ADMIN)));

    expect(result.ok).toBe(true);
  });
});

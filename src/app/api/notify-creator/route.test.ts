/**
 * Tests for the notify-creator webhook timeout and status-check fix (#1885).
 *
 * We exercise only the two new behaviours added by the fix:
 *   1. A non-2xx webhook response returns 502.
 *   2. A timed-out (or aborted) fetch returns 502.
 *
 * The full route depends on many external modules (StellarSdk, contractClient,
 * persistentStore, rateLimit), so we mock them at the boundary and focus on
 * the webhook-call section that changed.
 */


// ── module mocks ──────────────────────────────────────────────────────────────

jest.mock("@stellar/stellar-sdk", () => ({
  hash: jest.fn(() => Buffer.alloc(32)),
  verify: jest.fn(() => true),
  StrKey: { decodeEd25519PublicKey: jest.fn(() => Buffer.alloc(32)) },
}));

jest.mock("@/lib/contractClient", () => ({
  getCampaign: jest.fn().mockResolvedValue({
    creator: "GCREATOR123456789012345678901234567890123456789012345678",
  }),
}));

const mockStore = {
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue({
    email: "user@example.com",
    campaignId: 1,
    campaignTitle: "Test",
    creatorAddress: "GCREATOR123456789012345678901234567890123456789012345678",
    expiresAt: Date.now() + 86_400_000,
  }),
  delete: jest.fn().mockResolvedValue(undefined),
};
jest.mock("@/lib/persistentStore", () => ({
  getKeyValueStore: jest.fn(() => mockStore),
}));

jest.mock("@/lib/rateLimit", () => ({
  createRateLimiter: jest.fn(() => ({ check: jest.fn().mockResolvedValue(true) })),
  getClientIp: jest.fn(() => "127.0.0.1"),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

const CREATOR = "GCREATOR123456789012345678901234567890123456789012345678";

function makePostRequest(overrides: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/notify-creator", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-wallet-address": CREATOR,
      "x-request-signature": "aabbcc",
      "x-request-timestamp": String(Math.floor(Date.now() / 1000)),
      "x-request-purpose": "notify-creator",
      ...overrides,
    },
    body: JSON.stringify({
      email: "user@example.com",
      campaignId: 1,
      campaignTitle: "Test Campaign",
      creatorAddress: CREATOR,
    }),
  });
}

function makeGetRequest(token = "valid-token"): Request {
  return new Request(`http://localhost/api/notify-creator?token=${token}`);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("notify-creator webhook timeout and status check (#1885)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, CREATOR_EMAIL_WEBHOOK_URL: "https://hooks.example.com/notify" };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe("POST — pending confirmation webhook", () => {
    it("returns 202 when the webhook replies with 2xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });
      const { POST } = await import("./route");
      const res = await POST(makePostRequest());
      expect(res.status).toBe(202);
    });

    it("returns 502 when the webhook replies with a non-2xx status", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
      const { POST } = await import("./route");
      const res = await POST(makePostRequest());
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toMatch(/webhook dispatch failed/i);
    });

    it("returns 502 when the webhook fetch times out (AbortError)", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        Object.assign(new Error("The operation was aborted"), { name: "AbortError" }),
      );
      const { POST } = await import("./route");
      const res = await POST(makePostRequest());
      expect(res.status).toBe(502);
    });
  });

  describe("GET — confirmation webhook", () => {
    it("returns 200 when the confirmation webhook replies with 2xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });
      const { GET } = await import("./route");
      const res = await GET(makeGetRequest());
      expect(res.status).toBe(200);
    });

    it("returns 502 when the confirmation webhook replies with a non-2xx status", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
      const { GET } = await import("./route");
      const res = await GET(makeGetRequest());
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toMatch(/webhook dispatch failed/i);
    });

    it("returns 502 when the confirmation fetch times out", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        Object.assign(new Error("timeout"), { name: "AbortError" }),
      );
      const { GET } = await import("./route");
      const res = await GET(makeGetRequest());
      expect(res.status).toBe(502);
    });
  });
});

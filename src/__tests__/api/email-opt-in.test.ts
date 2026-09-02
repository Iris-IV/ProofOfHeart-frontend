import { NextRequest } from "next/server";
import { POST } from "@/app/api/email-opt-in/route";

// The repo's jest setup (src/setupTests.ts) assumes a DOM environment, and jsdom
// does not provide the global Request/Response that next/server needs at import
// time. Mock next/server with minimal stubs so the route can be tested in the
// default jsdom environment instead of relying on a node-only environment.
jest.mock("next/server", () => {
  class NextRequest {
    private bodyText: string;
    headers: { get: (name: string) => string | null };

    constructor(
      input: string,
      init?: { method?: string; headers?: Record<string, string>; body?: string },
    ) {
      const headers = init?.headers ?? {};
      this.headers = {
        get: (name: string) => headers[name.toLowerCase()] ?? null,
      };
      this.bodyText = init?.body ?? "";
    }

    async text(): Promise<string> {
      return this.bodyText;
    }

    async json(): Promise<unknown> {
      return JSON.parse(this.bodyText);
    }
  }

  class NextResponse {
    readonly status: number;
    private payload: unknown;

    private constructor(payload: unknown, init?: { status?: number }) {
      this.payload = payload;
      this.status = init?.status ?? 200;
    }

    static json(payload: unknown, init?: { status?: number }): NextResponse {
      return new NextResponse(payload, init);
    }

    async json(): Promise<unknown> {
      return this.payload;
    }
  }

  return { NextRequest, NextResponse };
});

const WEBHOOK_URL = "https://webhook.example.test/creator-email";

function makeRequest(body: unknown, ip = "203.0.113.1"): NextRequest {
  return new NextRequest("http://localhost/api/email-opt-in", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/email-opt-in", () => {
  beforeEach(() => {
    process.env.CREATOR_EMAIL_WEBHOOK_URL = WEBHOOK_URL;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete process.env.CREATOR_EMAIL_WEBHOOK_URL;
  });

  it("returns 501 when the webhook is not configured", async () => {
    delete process.env.CREATOR_EMAIL_WEBHOOK_URL;

    const response = await POST(makeRequest({ email: "creator@example.com", campaignTitle: "A" }));

    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({ ok: false, message: "Webhook not configured" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid JSON body", async () => {
    const response = await POST(makeRequest("not json"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, message: "Invalid JSON body" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for a JSON null body without crashing", async () => {
    const response = await POST(makeRequest("null"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      message: "Missing required fields: email, campaignTitle",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for a body larger than the size cap", async () => {
    const bigField = "a".repeat(20 * 1024);
    const response = await POST(
      makeRequest({ email: "creator@example.com", campaignTitle: bigField }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, message: "Request body too large" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await POST(makeRequest({ email: "creator@example.com" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      message: "Missing required fields: email, campaignTitle",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email format", async () => {
    const response = await POST(makeRequest({ email: "not-an-email", campaignTitle: "A" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, message: "Invalid email format" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("forwards a valid event to the webhook and returns 202", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const response = await POST(
      makeRequest({ email: "creator@example.com", campaignTitle: "Clean Water", campaignId: 7 }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(WEBHOOK_URL);
    const forwarded = JSON.parse(init.body);
    expect(forwarded).toMatchObject({
      email: "creator@example.com",
      campaignTitle: "Clean Water",
      campaignId: 7,
      source: "proof_of_heart_frontend",
    });
    expect(typeof forwarded.timestamp).toBe("string");
  });

  it("returns 502 when the webhook responds with an error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const response = await POST(makeRequest({ email: "creator@example.com", campaignTitle: "A" }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, message: "Webhook request failed" });
  });

  it("returns 502 when forwarding throws", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network down"));

    const response = await POST(makeRequest({ email: "creator@example.com", campaignTitle: "A" }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, message: "Webhook request failed" });
  });

  it("rate-limits repeat requests from the same client", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const ip = "198.51.100.99";
    let lastStatus = 0;
    for (let i = 0; i < 11; i += 1) {
      const response = await POST(
        makeRequest({ email: "creator@example.com", campaignTitle: "A" }, ip),
      );
      lastStatus = response.status;
    }

    expect(lastStatus).toBe(429);
    const limited = await POST(
      makeRequest({ email: "creator@example.com", campaignTitle: "A" }, ip),
    );
    expect(await limited.json()).toEqual({
      ok: false,
      message: "Too many requests. Please slow down.",
    });
  });
});

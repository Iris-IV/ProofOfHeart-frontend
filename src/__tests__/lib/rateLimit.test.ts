import { getClientIp, rateLimitKeyFromRequest } from "@/lib/rateLimit";

function makeReq(opts: {
  ip?: string;
  headers?: Record<string, string>;
}): { headers: { get(name: string): string | null }; ip?: string } {
  return {
    ip: opts.ip,
    headers: {
      get(name: string) {
        return opts.headers?.[name.toLowerCase()] ?? null;
      },
    },
  };
}

describe("getClientIp", () => {
  it("prefers req.ip when present", () => {
    expect(getClientIp(makeReq({ ip: "1.2.3.4" }))).toBe("1.2.3.4");
  });

  it("prefers x-vercel-ip over x-forwarded-for", () => {
    const req = makeReq({
      headers: {
        "x-vercel-ip": "5.6.7.8",
        "x-forwarded-for": "9.9.9.9, 10.10.10.10",
      },
    });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("uses right-most x-forwarded-for hop (not client-controlled left-most)", () => {
    const req = makeReq({
      headers: { "x-forwarded-for": "attacker.example.com, 11.12.13.14" },
    });
    expect(getClientIp(req)).toBe("11.12.13.14");
  });

  it("returns unknown-client when no ip signal is present", () => {
    expect(getClientIp(makeReq({}))).toBe("unknown-client");
  });
});

// ─── #1880: rotating reporterAddress must not bypass rate limit ───────────────

describe("rateLimitKeyFromRequest (#1880)", () => {
  it("returns the client IP, ignoring any wallet address argument", () => {
    const req = makeReq({ ip: "1.2.3.4" });
    // No second argument — the old signature accepted a walletAddress; the
    // new one does not.
    expect(rateLimitKeyFromRequest(req)).toBe("1.2.3.4");
  });

  it("two requests with the same IP but different addresses get the same key", () => {
    const req = makeReq({ ip: "1.2.3.4" });
    const key1 = rateLimitKeyFromRequest(req);
    const key2 = rateLimitKeyFromRequest(req);
    expect(key1).toBe(key2);
  });

  it("falls back to x-vercel-ip when req.ip is absent", () => {
    const req = makeReq({ headers: { "x-vercel-ip": "5.6.7.8" } });
    expect(rateLimitKeyFromRequest(req)).toBe("5.6.7.8");
  });

  it("falls back to unknown-client when no IP signal is present", () => {
    const req = makeReq({});
    expect(rateLimitKeyFromRequest(req)).toBe("unknown-client");
  });
});

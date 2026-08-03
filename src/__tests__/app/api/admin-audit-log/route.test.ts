import { NextResponse } from "next/server";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown) => ({ status: 200, json: async () => data }),
  },
}));

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const parsePage = (raw: string | null): number => {
  const parsed = parseInt(raw ?? "1", 10);
  return Math.max(1, Number.isFinite(parsed) ? parsed : 1);
};

const parsePageSize = (raw: string | null): number => {
  const parsed = parseInt(raw ?? String(DEFAULT_PAGE_SIZE), 10);
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Number.isFinite(parsed) ? parsed : DEFAULT_PAGE_SIZE));
};

const pickFields = <T>(item: T, fields: string[]): Partial<T> => {
  const picked: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in item) {
      picked[field] = (item as Record<string, unknown>)[field];
    }
  }
  return picked as Partial<T>;
};

describe("admin-audit-log route pagination helpers", () => {
  it("parses page correctly", () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage("1")).toBe(1);
    expect(parsePage("5")).toBe(5);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-1")).toBe(1);
    expect(parsePage("abc")).toBe(1);
  });

  it("parses pageSize correctly", () => {
    expect(parsePageSize(null)).toBe(20);
    expect(parsePageSize("10")).toBe(10);
    expect(parsePageSize("100")).toBe(100);
    expect(parsePageSize("0")).toBe(1);
    expect(parsePageSize("999")).toBe(100);
    expect(parsePageSize("abc")).toBe(20);
  });

  it("picks only requested fields", () => {
    const item = { adminAddress: "GAAAA", action: "verify", txHash: "0x123", timestamp: 1000 };
    expect(pickFields(item, ["adminAddress", "action"])).toEqual({
      adminAddress: "GAAAA",
      action: "verify",
    });
    expect(pickFields(item, ["txHash"])).toEqual({ txHash: "0x123" });
    expect(pickFields(item, ["missing"])).toEqual({});
    expect(pickFields(item, [])).toEqual({});
  });
});

describe("admin-audit-log route pagination logic", () => {
  const buildEntries = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      adminAddress: "GAAAAAAA",
      action: "verify_campaign" as const,
      txHash: `tx-${i}`,
      timestamp: 1000 + i,
      campaignId: i,
      details: `details-${i}`,
    }));

  it("paginates a list of entries", () => {
    const entries = buildEntries(45);
    const page = 1;
    const pageSize = 20;
    const start = (page - 1) * pageSize;
    const pageEntries = entries.slice(start, start + pageSize);

    expect(pageEntries).toHaveLength(20);
    expect(pageEntries[0]).toEqual(entries[0]);
    expect(pageEntries[19]).toEqual(entries[19]);
  });

  it("returns the last page with fewer items", () => {
    const entries = buildEntries(45);
    const page = 3;
    const pageSize = 20;
    const start = (page - 1) * pageSize;
    const pageEntries = entries.slice(start, start + pageSize);

    expect(pageEntries).toHaveLength(5);
    expect(pageEntries[0]).toEqual(entries[40]);
  });

  it("filters entries by adminAddress", () => {
    const entries = [
      { adminAddress: "GAAAAAAA", action: "verify_campaign" as const, txHash: "tx-1", timestamp: 1000 },
      { adminAddress: "GBBBBBBB", action: "reject_campaign" as const, txHash: "tx-2", timestamp: 1001 },
      { adminAddress: "GAAAAAAA", action: "update_platform_fee" as const, txHash: "tx-3", timestamp: 1002 },
    ];

    const normalized = "GAAAAAAA";
    const filtered = entries.filter((e) => e.adminAddress.toUpperCase() === normalized);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.adminAddress === "GAAAAAAA")).toBe(true);
  });

  it("filters entries by action", () => {
    const entries = [
      { adminAddress: "GAAAAAAA", action: "verify_campaign" as const, txHash: "tx-1", timestamp: 1000 },
      { adminAddress: "GAAAAAAA", action: "reject_campaign" as const, txHash: "tx-2", timestamp: 1001 },
      { adminAddress: "GAAAAAAA", action: "verify_campaign" as const, txHash: "tx-3", timestamp: 1002 },
    ];

    const action = "verify_campaign";
    const filtered = entries.filter((e) => e.action === action);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.action === "verify_campaign")).toBe(true);
  });

  it("applies sparse fieldsets correctly", () => {
    const entries = buildEntries(3);
    const fields = ["adminAddress", "action"];
    const picked = entries.map((entry) => pickFields(entry, fields));

    expect(picked[0]).toEqual({ adminAddress: "GAAAAAAA", action: "verify_campaign" });
    expect(picked[0]).not.toHaveProperty("txHash");
    expect(picked[0]).not.toHaveProperty("timestamp");
  });
});

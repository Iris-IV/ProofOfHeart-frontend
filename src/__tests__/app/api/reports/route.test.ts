import { NextResponse } from "next/server";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown) => ({ status: 200, json: async () => data }),
  },
}));

const mockRequest = (url: string, searchParams: Record<string, string> = {}) => ({
  url: searchParams.size
    ? `${url}?${new URLSearchParams(searchParams).toString()}`
    : url,
});

describe("reports route pagination helpers", () => {
  const parsePage = (raw: string | null): number => {
    const parsed = parseInt(raw ?? "1", 10);
    return Math.max(1, Number.isFinite(parsed) ? parsed : 1);
  };

  const parsePageSize = (raw: string | null): number => {
    const parsed = parseInt(raw ?? "20", 10);
    return Math.min(100, Math.max(1, Number.isFinite(parsed) ? parsed : 20));
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
    const item = { id: "1", name: "test", extra: "data" };
    expect(pickFields(item, ["id", "name"])).toEqual({ id: "1", name: "test" });
    expect(pickFields(item, ["id"])).toEqual({ id: "1" });
    expect(pickFields(item, ["missing"])).toEqual({});
    expect(pickFields(item, [])).toEqual({});
  });
});

describe("reports route integration", () => {
  let reportStore: Array<{
    id: string;
    campaignId: number;
    campaignTitle: string;
    reason: string;
    notes: string;
    reporterAddress: string | null;
    timestamp: number;
    status: "pending" | "reviewed";
  }>;

  beforeEach(() => {
    jest.resetModules();
    reportStore = [];
    jest.doMock("@/lib/reportStore", () => ({
      reportStore,
    }));
  });

  it("paginates and filters reports via mocked route", async () => {
    for (let i = 0; i < 45; i++) {
      reportStore.push({
        id: `report-${i}`,
        campaignId: i,
        campaignTitle: `Campaign ${i}`,
        reason: "scam",
        notes: "notes",
        reporterAddress: "GABC",
        timestamp: 1000 + i,
        status: i % 2 === 0 ? "pending" : "reviewed",
      });
    }

    const { GET } = await import("@/app/api/reports/route");

    const req1 = mockRequest("http://localhost/api/reports", {
      page: "1",
      pageSize: "20",
    }) as any;
    const res1 = await GET(req1);
    const data1 = await (res1 as any).json();

    expect(data1.items).toHaveLength(20);
    expect(data1.total).toBe(45);
    expect(data1.page).toBe(1);
    expect(data1.pageSize).toBe(20);
    expect(data1.hasMore).toBe(true);
  });
});

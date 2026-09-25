import {
  getServerTimeOffsetMs,
  isOffsetTrustworthy,
  nowWithOffset,
  MAX_PLAUSIBLE_OFFSET_MS,
} from "@/lib/serverTime";

const CLIENT_NOW = Date.parse("2026-01-01T12:00:00.000Z");

function mockFetchWithDateHeader(dateString: string | null) {
  return jest.fn().mockResolvedValue({
    headers: { get: () => dateString },
  });
}

describe("getServerTimeOffsetMs", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(CLIENT_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns the difference between the server and client clocks", async () => {
    const serverTime = new Date(CLIENT_NOW + 7_200_000).toUTCString();
    const fetchImpl = mockFetchWithDateHeader(serverTime);

    const offset = await getServerTimeOffsetMs(fetchImpl as unknown as typeof fetch);

    // HTTP `Date` has one-second resolution, so allow for the truncation.
    expect(offset).not.toBeNull();
    expect(Math.abs((offset as number) - 7_200_000)).toBeLessThanOrEqual(1_000);
    expect(fetchImpl).toHaveBeenCalledWith("/api/health", { cache: "no-store" });
  });

  it("returns null when the response carries no Date header", async () => {
    const fetchImpl = mockFetchWithDateHeader(null);
    await expect(getServerTimeOffsetMs(fetchImpl as unknown as typeof fetch)).resolves.toBeNull();
  });

  it("returns null when the Date header is unparseable", async () => {
    const fetchImpl = mockFetchWithDateHeader("not-a-date");
    await expect(getServerTimeOffsetMs(fetchImpl as unknown as typeof fetch)).resolves.toBeNull();
  });

  it("returns null instead of throwing when the request fails", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("offline"));
    await expect(getServerTimeOffsetMs(fetchImpl as unknown as typeof fetch)).resolves.toBeNull();
  });

  it("corrects a client clock that is two hours fast", async () => {
    const skewedClientNow = CLIENT_NOW + 7_200_000;
    jest.setSystemTime(skewedClientNow);

    const fetchImpl = mockFetchWithDateHeader(new Date(CLIENT_NOW).toUTCString());
    const offset = await getServerTimeOffsetMs(fetchImpl as unknown as typeof fetch);

    expect(Math.abs((offset as number) + 7_200_000)).toBeLessThanOrEqual(1_000);
  });
});

describe("isOffsetTrustworthy", () => {
  it("accepts a measured skew of a couple of hours", () => {
    expect(isOffsetTrustworthy(-7_200_000)).toBe(true);
  });

  it("accepts zero", () => {
    expect(isOffsetTrustworthy(0)).toBe(true);
  });

  it("rejects a missing offset", () => {
    expect(isOffsetTrustworthy(null)).toBe(false);
    expect(isOffsetTrustworthy(undefined)).toBe(false);
  });

  it("rejects non-finite offsets", () => {
    expect(isOffsetTrustworthy(Number.NaN)).toBe(false);
    expect(isOffsetTrustworthy(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("rejects an implausibly large offset", () => {
    expect(isOffsetTrustworthy(MAX_PLAUSIBLE_OFFSET_MS + 1)).toBe(false);
    expect(isOffsetTrustworthy(-MAX_PLAUSIBLE_OFFSET_MS - 1)).toBe(false);
  });
});

describe("nowWithOffset", () => {
  it("shifts the client clock onto the server timeline", () => {
    expect(nowWithOffset(-7_200_000, CLIENT_NOW + 7_200_000)).toBe(CLIENT_NOW);
  });

  it("falls back to the raw client clock when the offset is untrustworthy", () => {
    expect(nowWithOffset(null, CLIENT_NOW)).toBe(CLIENT_NOW);
    expect(nowWithOffset(MAX_PLAUSIBLE_OFFSET_MS + 1, CLIENT_NOW)).toBe(CLIENT_NOW);
  });
});

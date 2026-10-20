/** @jest-environment node */
import { GET } from "@/app/api/exchange-rates/route";

const originalFetch = global.fetch;
const fetchMock = jest.fn();
const validRates = () => ({ usd: 0.25, eur: 0.2, last_updated_at: Math.floor(Date.now() / 1000) });

beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
});

afterAll(() => {
  global.fetch = originalFetch;
});

it("returns validated quotes with a bounded cache lifetime", async () => {
  const rates = validRates();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ stellar: rates }) });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(rates);
  expect(response.headers.get("cache-control")).toBe("public, max-age=60, s-maxage=60");
  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd,eur&include_last_updated_at=true",
    expect.objectContaining({ next: { revalidate: 60 }, signal: expect.any(AbortSignal) }),
  );
});

it.each([
  undefined,
  { usd: 0, eur: 0.2, last_updated_at: 1 },
  { usd: -1, eur: 0.2, last_updated_at: 1 },
  { usd: "0.25", eur: 0.2, last_updated_at: 1 },
  { usd: 0.25, last_updated_at: 1 },
  { usd: 0.25, eur: Infinity, last_updated_at: 1 },
  { usd: 0.25, eur: 0.2, last_updated_at: 1 },
  { usd: 0.25, eur: 0.2, last_updated_at: 99999999999 },
])("rejects malformed or stale quotes: %j", async (stellar) => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ stellar }) });
  const response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "Exchange rates unavailable" });
});

it.each(["http", "network", "json"])("handles %s provider failures", async (failure) => {
  if (failure === "network") fetchMock.mockRejectedValue(new Error("timeout"));
  else fetchMock.mockResolvedValue({
    ok: failure !== "http",
    json: async () => { throw new Error("Invalid JSON"); },
  });
  expect((await GET()).status).toBe(503);
});

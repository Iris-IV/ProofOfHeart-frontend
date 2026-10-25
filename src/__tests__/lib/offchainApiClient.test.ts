// The client reads NEXT_PUBLIC_API_URL at module load, so each test re-imports it.
type Client = typeof import("@/lib/offchainApiClient");
type OffchainApiError = InstanceType<Client["OffchainApiError"]>;

function mockResponse(init: { status: number; statusText: string; body: string }) {
  return {
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    statusText: init.statusText,
    text: () => Promise.resolve(init.body),
    json: () => Promise.resolve(JSON.parse(init.body)),
  } as unknown as Response;
}

describe("requestOffchainJson error handling", () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;
  let client: Client;

  beforeEach(async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.test";
    jest.resetModules();
    client = await import("@/lib/offchainApiClient");
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalEnv;
    jest.restoreAllMocks();
  });

  it("uses the string message from a JSON error body", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        status: 400,
        statusText: "Bad Request",
        body: '{"message":"Report rejected"}',
      }),
    );

    const error = await client
      .requestOffchainJson("/api/reports", { retries: 0 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(client.OffchainApiError);
    expect((error as OffchainApiError).message).toBe("Report rejected");
    expect((error as OffchainApiError).status).toBe(400);
  });

  it("falls back to the status text when the body message is not a string", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ status: 422, statusText: "Unprocessable Entity", body: '{"message":42}' }),
      );

    const error = await client
      .requestOffchainJson("/api/reports", { retries: 0 })
      .catch((e: unknown) => e);

    expect((error as OffchainApiError).message).toBe("Unprocessable Entity");
    expect((error as OffchainApiError).details).toEqual({ message: 42 });
  });

  it("keeps non-JSON error text as details and uses the status text as the message", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ status: 500, statusText: "Internal Server Error", body: "gateway down" }),
      );

    const error = await client
      .requestOffchainJson("/api/reports", { retries: 0 })
      .catch((e: unknown) => e);

    expect((error as OffchainApiError).message).toBe("Internal Server Error");
    expect((error as OffchainApiError).details).toBe("gateway down");
  });
});

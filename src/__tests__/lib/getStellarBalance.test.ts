import { getStellarBalance } from "@/lib/getStellarBalance";
import { Horizon } from "@stellar/stellar-sdk";

jest.mock("@stellar/stellar-sdk", () => {
  const original = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...original,
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: jest.fn(),
      })),
    },
  };
});

describe("getStellarBalance", () => {
  let mockLoadAccount: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadAccount = jest.fn();
    (Horizon.Server as jest.Mock).mockImplementation(() => ({
      loadAccount: mockLoadAccount,
    }));
  });

  it("returns balance when account is funded", async () => {
    mockLoadAccount.mockResolvedValue({
      balances: [{ asset_type: "native", balance: "42.5" }],
    });

    const balance = await getStellarBalance("GABC123");
    expect(balance).toBe(42.5);
  });

  it("returns 0 when account is not funded (404 error)", async () => {
    const notFoundError = new Error("Not Found");
    (notFoundError as any).response = { status: 404 };
    mockLoadAccount.mockRejectedValue(notFoundError);

    const balance = await getStellarBalance("GABC123");
    expect(balance).toBe(0);
  });

  it("throws when fetch fails with non-404 error", async () => {
    const serverError = new Error("Internal Server Error");
    (serverError as any).response = { status: 500 };
    mockLoadAccount.mockRejectedValue(serverError);

    await expect(getStellarBalance("GABC123")).rejects.toThrow("Internal Server Error");
  });
});

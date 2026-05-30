import { getExplorerBase, explorerTxUrl, explorerAccountUrl } from "../../utils/explorer";

describe("Stellar Explorer Utility", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("proves testnet passphrase produces the testnet URL", () => {
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
    expect(getExplorerBase()).toBe("https://stellar.expert/explorer/testnet");
    expect(explorerTxUrl("hash123")).toBe("https://stellar.expert/explorer/testnet/tx/hash123");
    expect(explorerAccountUrl("address123")).toBe("https://stellar.expert/explorer/testnet/account/address123");
  });

  it("proves mainnet passphrase produces the mainnet URL", () => {
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015";
    expect(getExplorerBase()).toBe("https://stellar.expert/explorer/public");
    expect(explorerTxUrl("hash123")).toBe("https://stellar.expert/explorer/public/tx/hash123");
    expect(explorerAccountUrl("address123")).toBe("https://stellar.expert/explorer/public/account/address123");
  });

  it("falls back to testnet when network passphrase is unset", () => {
    delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
    expect(getExplorerBase()).toBe("https://stellar.expert/explorer/testnet");
  });
});

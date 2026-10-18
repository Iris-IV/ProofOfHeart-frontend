/**
 * Tests for network-aware explorer URL generation
 */

describe("Explorer URL generation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("getExplorerBase", () => {
    it("returns testnet explorer for testnet passphrase", () => {
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
      const { getExplorerBase } = require("@/utils/explorer");
      expect(getExplorerBase()).toBe("https://stellar.expert/explorer/testnet");
    });

    it("returns mainnet explorer for mainnet passphrase", () => {
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015";
      const { getExplorerBase } = require("@/utils/explorer");
      expect(getExplorerBase()).toBe("https://stellar.expert/explorer/public");
    });

    it("defaults to testnet when passphrase is not set", () => {
      delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
      const { getExplorerBase } = require("@/utils/explorer");
      expect(getExplorerBase()).toBe("https://stellar.expert/explorer/testnet");
    });

    it("is case-insensitive for test detection", () => {
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "TEST SDF Network ; September 2015";
      const { getExplorerBase } = require("@/utils/explorer");
      expect(getExplorerBase()).toBe("https://stellar.expert/explorer/testnet");
    });
  });

  describe("explorerTxUrl", () => {
    it("generates correct testnet transaction URL", () => {
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
      const { explorerTxUrl } = require("@/utils/explorer");
      const txHash = "abc123def456";
      expect(explorerTxUrl(txHash)).toBe("https://stellar.expert/explorer/testnet/tx/abc123def456");
    });

    it("generates correct mainnet transaction URL", () => {
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015";
      const { explorerTxUrl } = require("@/utils/explorer");
      const txHash = "xyz789uvw012";
      expect(explorerTxUrl(txHash)).toBe("https://stellar.expert/explorer/public/tx/xyz789uvw012");
    });
  });

  describe("explorerAccountUrl", () => {
    it("generates correct testnet account URL", () => {
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
      const { explorerAccountUrl } = require("@/utils/explorer");
      const address = "GABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD";
      expect(explorerAccountUrl(address)).toBe(
        `https://stellar.expert/explorer/testnet/account/${address}`,
      );
    });

    it("generates correct mainnet account URL", () => {
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015";
      const { explorerAccountUrl } = require("@/utils/explorer");
      const address = "GXYZ789UVW012ABC345DEF678GHI901JKL234MNO567PQR890STU123VWX";
      expect(explorerAccountUrl(address)).toBe(
        `https://stellar.expert/explorer/public/account/${address}`,
      );
    });
  });

  describe("Network switching", () => {
    it("switches from testnet to mainnet correctly", () => {
      // Start with testnet
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
      let { explorerTxUrl } = require("@/utils/explorer");
      expect(explorerTxUrl("tx1")).toContain("/testnet/");

      // Switch to mainnet
      jest.resetModules();
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015";
      ({ explorerTxUrl } = require("@/utils/explorer"));
      expect(explorerTxUrl("tx2")).toContain("/public/");
    });
  });
});

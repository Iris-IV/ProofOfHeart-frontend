import {
  saveWalletPreference,
  loadWalletPreference,
  clearWalletPreference,
  isWalletPreferenceFresh,
  type WalletPreference,
} from "../../lib/stellar";

describe("Wallet persistence (#1532)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("saveWalletPreference", () => {
    it("persists vendor and publicKey to localStorage", () => {
      saveWalletPreference("freighter", "GABCDEF...");
      const raw = localStorage.getItem("stellar_wallet_preference");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.vendor).toBe("freighter");
      expect(parsed.publicKey).toBe("GABCDEF...");
      expect(parsed.savedAt).toBeGreaterThan(0);
    });

    it("persists social wallet preference", () => {
      saveWalletPreference("social", "GSOCIAL...");
      const loaded = loadWalletPreference();
      expect(loaded).not.toBeNull();
      expect(loaded!.vendor).toBe("social");
      expect(loaded!.publicKey).toBe("GSOCIAL...");
    });
  });

  describe("loadWalletPreference", () => {
    it("returns null when no preference is stored", () => {
      expect(loadWalletPreference()).toBeNull();
    });

    it("loads a valid preference", () => {
      const now = Date.now();
      const preference: WalletPreference = {
        vendor: "freighter",
        publicKey: "GLOAD...",
        savedAt: now,
      };
      localStorage.setItem("stellar_wallet_preference", JSON.stringify(preference));

      const loaded = loadWalletPreference();
      expect(loaded).toEqual(preference);
    });

    it("returns null for invalid JSON", () => {
      localStorage.setItem("stellar_wallet_preference", "not-json");
      expect(loadWalletPreference()).toBeNull();
    });

    it("returns null for malformed preference (missing vendor)", () => {
      localStorage.setItem(
        "stellar_wallet_preference",
        JSON.stringify({ publicKey: "G...", savedAt: Date.now() }),
      );
      expect(loadWalletPreference()).toBeNull();
    });

    it("returns null for malformed preference (missing publicKey)", () => {
      localStorage.setItem(
        "stellar_wallet_preference",
        JSON.stringify({ vendor: "freighter", savedAt: Date.now() }),
      );
      expect(loadWalletPreference()).toBeNull();
    });

    it("returns null for malformed preference (missing savedAt)", () => {
      localStorage.setItem(
        "stellar_wallet_preference",
        JSON.stringify({ vendor: "freighter", publicKey: "G..." }),
      );
      expect(loadWalletPreference()).toBeNull();
    });
  });

  describe("clearWalletPreference", () => {
    it("removes the stored preference", () => {
      saveWalletPreference("freighter", "GCLEAR...");
      expect(localStorage.getItem("stellar_wallet_preference")).not.toBeNull();

      clearWalletPreference();
      expect(localStorage.getItem("stellar_wallet_preference")).toBeNull();
    });

    it("does not throw when no preference is stored", () => {
      expect(() => clearWalletPreference()).not.toThrow();
    });
  });

  describe("isWalletPreferenceFresh", () => {
    it("returns true for a freshly saved preference", () => {
      const preference: WalletPreference = {
        vendor: "freighter",
        publicKey: "GFRESH...",
        savedAt: Date.now(),
      };
      expect(isWalletPreferenceFresh(preference)).toBe(true);
    });

    it("returns true for a preference saved 6 days ago (within 7-day default)", () => {
      const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000;
      const preference: WalletPreference = {
        vendor: "social",
        publicKey: "GSIX...",
        savedAt: sixDaysAgo,
      };
      expect(isWalletPreferenceFresh(preference)).toBe(true);
    });

    it("returns false for a preference saved 8 days ago (stale)", () => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      const preference: WalletPreference = {
        vendor: "freighter",
        publicKey: "GOLD...",
        savedAt: eightDaysAgo,
      };
      expect(isWalletPreferenceFresh(preference)).toBe(false);
    });

    it("respects custom maxAgeMs", () => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const preference: WalletPreference = {
        vendor: "freighter",
        publicKey: "GCUSTOM...",
        savedAt: oneHourAgo,
      };
      // Fresh with 2-hour window
      expect(isWalletPreferenceFresh(preference, { maxAgeMs: 2 * 60 * 60 * 1000 })).toBe(true);
      // Stale with 30-minute window
      expect(isWalletPreferenceFresh(preference, { maxAgeMs: 30 * 60 * 1000 })).toBe(false);
    });

    it("treats the exact boundary as fresh (age === maxAgeMs)", () => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const preference: WalletPreference = {
        vendor: "freighter",
        publicKey: "GBOUNDARY...",
        savedAt: oneHourAgo,
      };
      // Exactly 1 hour old, with a 1-hour window
      expect(isWalletPreferenceFresh(preference, { maxAgeMs: 60 * 60 * 1000 })).toBe(true);
    });
  });
});

import {
  normalizeAddress,
  isSameAddress,
  parseSorobanError,
  localizedContractErrorMessage,
  SorobanContractError,
  checkLedgerStateConsistency,
  waitForConsistentLedgerState,
  CONTRACT_ERROR_FALLBACK_KEY,
} from "./stellar";

describe("Stellar Address Utilities", () => {
  describe("normalizeAddress", () => {
    it("should convert mixed-case addresses to uppercase", () => {
      const addr = "gdqwpn6p6v6x5w7k5e7p5z2r5z2r5z2r5z2r5z2r5z2r5z2r5z2r";
      expect(normalizeAddress(addr)).toBe(addr.toUpperCase());
    });

    it("should trim whitespace from addresses", () => {
      const addr = "  GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R  ";
      expect(normalizeAddress(addr)).toBe("GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R");
    });

    it("should handle null or undefined gracefully", () => {
      expect(normalizeAddress(null)).toBe("");
      expect(normalizeAddress(undefined)).toBe("");
    });
  });

  describe("isSameAddress", () => {
    it("should return true for identical addresses", () => {
      const addr = "GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R";
      expect(isSameAddress(addr, addr)).toBe(true);
    });

    it("should return true for addresses with different casing", () => {
      const addrUpper = "GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R";
      const addrLower = "gdqwpn6p6v6x5w7k5e7p5z2r5z2r5z2r5z2r5z2r5z2r5z2r5z2r";
      expect(isSameAddress(addrUpper, addrLower)).toBe(true);
    });

    it("should return true for addresses with extra whitespace", () => {
      const addr1 = "GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R";
      const addr2 = "  GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R  ";
      expect(isSameAddress(addr1, addr2)).toBe(true);
    });

    it("should return false for different addresses", () => {
      const addr1 = "GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R";
      const addr2 = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      expect(isSameAddress(addr1, addr2)).toBe(false);
    });

    it("should return false if one address is null/undefined", () => {
      const addr = "GDQWPN6P6V6X5W7K5E7P5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R5Z2R";
      expect(isSameAddress(addr, null)).toBe(false);
      expect(isSameAddress(undefined, addr)).toBe(false);
    });
  });
});

describe("Soroban contract error translation", () => {
  describe("parseSorobanError", () => {
    it("translates known contract codes to typed errors with localized messages", () => {
      const parsed = parseSorobanError(new Error("HostError: Error(Contract, #3)"));

      expect(parsed).toBeInstanceOf(SorobanContractError);
      expect(parsed.code).toBe(3);
      expect(parsed.translationKey).toBe("ContractErrors.CampaignNotActive");
      expect(parsed.localizedMessage).toBe("This campaign is no longer accepting contributions.");
    });

    it("extracts custom contract codes outside the known enum (e.g. #101)", () => {
      const parsed = parseSorobanError(new Error("HostError: Error(Contract, #101)"));

      expect(parsed.code).toBe(101);
      expect(parsed.translationKey).toBe(CONTRACT_ERROR_FALLBACK_KEY);
      expect(parsed.localizedMessage).toBe("The contract rejected this transaction (error #101).");
    });

    it("extracts codes from nested RPC error shapes", () => {
      const parsed = parseSorobanError({
        errorResult: { message: "HostError: Error(Contract, #29)" },
      });

      expect(parsed.code).toBe(29);
      expect(parsed.translationKey).toBe("ContractErrors.InsufficientBalance");
    });

    it("returns Spanish messages when the locale is es", () => {
      const parsed = parseSorobanError(new Error("Error(Contract, #1)"), "es");

      expect(parsed.localizedMessage).toBe("No estás autorizado para realizar esta acción.");
    });

    it("falls back to Spanish generic text for unknown codes under es locale", () => {
      const parsed = parseSorobanError(new Error("Error(Contract, #101)"), "es");

      expect(parsed.localizedMessage).toBe("El contrato rechazó esta transacción (error #101).");
    });

    it("keeps the original message when no contract code can be extracted", () => {
      const parsed = parseSorobanError(new Error("Network hiccup"));

      expect(parsed.code).toBeNull();
      expect(parsed.translationKey).toBe(CONTRACT_ERROR_FALLBACK_KEY);
      expect(parsed.localizedMessage).toBe("Network hiccup");
    });

    it("uses the provided fallback for empty errors", () => {
      const parsed = parseSorobanError(null, "en", "Transaction failed.");

      expect(parsed.code).toBeNull();
      expect(parsed.localizedMessage).toBe("Transaction failed.");
    });

    it("handles string-thrown contract errors", () => {
      const parsed = parseSorobanError("Error(Contract, #20)");

      expect(parsed.code).toBe(20);
      expect(parsed.translationKey).toBe("ContractErrors.AlreadyClaimed");
    });
  });

  describe("localizedContractErrorMessage", () => {
    it("returns only the localized message", () => {
      expect(localizedContractErrorMessage(new Error("Error(Contract, #11)"))).toBe(
        "The funds for this campaign have already been withdrawn.",
      );
    });

    it("describes unknown revert codes with their numeric code", () => {
      expect(localizedContractErrorMessage(new Error("Error(Contract, #250)"))).toBe(
        "The contract rejected this transaction (error #250).",
      );
    });
  });
});

describe("ledger state consistency", () => {
  const CACHED_AT = 1_700_000_000_000;

  describe("checkLedgerStateConsistency", () => {
    it("reports a fresh, in-lag snapshot as consistent", () => {
      const result = checkLedgerStateConsistency(
        { ledgerSequence: 1_000, cachedAt: CACHED_AT },
        1_001,
        { now: CACHED_AT + 1_000 },
      );

      expect(result.consistent).toBe(true);
      expect(result.lag).toBe(1);
      expect(result.reason).toBeUndefined();
    });

    it("flags a snapshot older than maxAgeMs as stale", () => {
      const result = checkLedgerStateConsistency(
        { ledgerSequence: 1_000, cachedAt: CACHED_AT },
        1_001,
        { maxAgeMs: 30_000, now: CACHED_AT + 31_000 },
      );

      expect(result.consistent).toBe(false);
      expect(result.reason).toBe("stale_snapshot");
      expect(result.ageMs).toBe(31_000);
    });

    it("flags a snapshot lagging more than maxLag ledgers as drifted", () => {
      const result = checkLedgerStateConsistency(
        { ledgerSequence: 1_000, cachedAt: CACHED_AT },
        1_010,
        { maxLag: 2, now: CACHED_AT + 5_000 },
      );

      expect(result.consistent).toBe(false);
      expect(result.reason).toBe("ledger_drift");
      expect(result.lag).toBe(10);
    });

    it("treats a snapshot ahead of the remote sequence as consistent (RPC lag behind)", () => {
      const result = checkLedgerStateConsistency(
        { ledgerSequence: 1_005, cachedAt: CACHED_AT },
        1_003,
        { now: CACHED_AT + 1_000 },
      );

      expect(result.consistent).toBe(true);
      expect(result.lag).toBe(-2);
    });
  });

  describe("waitForConsistentLedgerState", () => {
    it("resolves as soon as the remote ledger catches up", async () => {
      const sequences = [1_020, 1_010, 1_001];
      const read = jest.fn().mockImplementation(() => Promise.resolve(sequences.shift() ?? 1_001));

      const result = await waitForConsistentLedgerState(
        read,
        { ledgerSequence: 1_000, cachedAt: Date.now() },
        { maxLag: 2, maxAgeMs: 60_000, timeoutMs: 5_000, pollIntervalMs: 1 },
      );

      expect(result.consistent).toBe(true);
      expect(result.lag).toBe(1);
      expect(read).toHaveBeenCalledTimes(3);
    });

    it("returns a timeout result when the remote never catches up", async () => {
      const read = jest.fn().mockResolvedValue(5_000);

      const result = await waitForConsistentLedgerState(
        read,
        { ledgerSequence: 1_000, cachedAt: Date.now() },
        { maxLag: 2, maxAgeMs: 600_000, timeoutMs: 20, pollIntervalMs: 5 },
      );

      expect(result.consistent).toBe(false);
      expect(result.reason).toBe("timeout");
      expect(read.mock.calls.length).toBeGreaterThan(0);
    });

    it("returns immediately when the first poll is already consistent", async () => {
      const read = jest.fn().mockResolvedValue(1_000);

      const result = await waitForConsistentLedgerState(
        read,
        { ledgerSequence: 1_000, cachedAt: Date.now() },
        { pollIntervalMs: 1 },
      );

      expect(result.consistent).toBe(true);
      expect(read).toHaveBeenCalledTimes(1);
    });
  });
});

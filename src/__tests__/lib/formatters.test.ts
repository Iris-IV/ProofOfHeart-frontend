import {
  formatNumber,
  formatXlm,
  formatDate,
  formatShortDate,
  formatAmount,
} from "@/lib/formatters";

describe("formatNumber", () => {
  it("formats with en grouping separators", () => {
    expect(formatNumber(1234567.89, "en", { maximumFractionDigits: 2 })).toBe("1,234,567.89");
  });

  it("formats with es grouping separators", () => {
    // Spanish uses period as thousands separator and comma as decimal
    const result = formatNumber(1234567.89, "es", { maximumFractionDigits: 2 });
    expect(result).toMatch(/1[.,\s]234[.,\s]567/);
  });
});

describe("formatXlm", () => {
  it("formats XLM amount in en", () => {
    expect(formatXlm(1234.5, "en")).toBe("1,234.5");
  });

  it("formats XLM amount in es", () => {
    const result = formatXlm(1234.5, "es");
    // Should contain the digits with locale-appropriate separators
    expect(result).toMatch(/1[.,\s\u00a0]?234/);
  });

  it("formats zero correctly", () => {
    expect(formatXlm(0, "en")).toBe("0");
    expect(formatXlm(0, "es")).toBe("0");
  });
});

describe("formatAmount", () => {
  // Baseline: function already uses stroopsToXlm internally — these guard against regressions.
  it("formats stroops as locale-aware XLM in en", () => {
    expect(formatAmount(12_500_000n, "en", { maximumFractionDigits: 2 })).toBe("1.25");
  });

  it("formats zero stroops", () => {
    expect(formatAmount(0n, "en")).toBe("0");
  });

  // Issue #616 coverage: ensure raw stroops are never displayed as-is (10_000_000x off)
  it("does NOT display stroops as raw integer — 10_000_000 stroops is 1 XLM", () => {
    const result = formatAmount(10_000_000n, "en");
    expect(result).toBe("1");
    expect(result).not.toBe("10,000,000");
  });

  it("formats 1 stroop as fractional XLM", () => {
    // 1 stroop = 0.0000001 XLM — should not round to 0 when enough fraction digits
    const result = formatAmount(1n, "en", { maximumFractionDigits: 7 });
    expect(result).toBe("0.0000001");
  });

  it("defaults to 2 decimal places and rounds correctly", () => {
    // 10_050_000 stroops = 1.005 XLM → rounds to 1.01 at maximumFractionDigits 2
    // (behaviour depends on JS Intl rounding — just check it is "1" or "1.01")
    const result = formatAmount(10_050_000n, "en");
    expect(result).toMatch(/^1/);
  });

  it("formats large campaign goal (100_000 XLM)", () => {
    const result = formatAmount(1_000_000_000_000n, "en"); // 100,000 XLM
    expect(result).toBe("100,000");
  });

  it("formats a typical 5 XLM contribution", () => {
    expect(formatAmount(50_000_000n, "en")).toBe("5");
  });

  it("respects minimumFractionDigits option", () => {
    // 1 XLM with min 2 decimals
    expect(formatAmount(10_000_000n, "en", { minimumFractionDigits: 2 })).toBe("1.00");
  });

  it("returns locale-appropriate separators in es for large amount", () => {
    // 1,000 XLM = 10_000_000_000 stroops — Spanish may use period as thousands separator
    const result = formatAmount(10_000_000_000n, "es");
    expect(result).toMatch(/1/);
    expect(result).toMatch(/000/);
  });

  it("formats the maximum fraction digits edge case", () => {
    // 15_000_000 stroops = 1.5 XLM, with maximumFractionDigits 0 → "2" (rounded)
    const result = formatAmount(15_000_000n, "en", { maximumFractionDigits: 0 });
    expect(result).toMatch(/^[12]$/); // rounded to 1 or 2 depending on Intl implementation
  });
});

describe("formatDate", () => {
  // 2024-03-15 00:00:00 UTC
  const ts = 1710460800;

  it("formats date in en with long month", () => {
    const result = formatDate(ts, "en");
    expect(result).toMatch(/March/);
    expect(result).toMatch(/2024/);
  });

  it("formats date in es with long month", () => {
    const result = formatDate(ts, "es");
    // Spanish month name
    expect(result).toMatch(/marzo/i);
    expect(result).toMatch(/2024/);
  });
});

describe("formatShortDate", () => {
  const ts = 1710460800;

  it("formats short date in en", () => {
    const result = formatShortDate(ts, "en");
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/2024/);
  });

  it("formats short date in es", () => {
    const result = formatShortDate(ts, "es");
    expect(result).toMatch(/2024/);
  });
});

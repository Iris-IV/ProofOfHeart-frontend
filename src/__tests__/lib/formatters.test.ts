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
  it("formats stroops as locale-aware XLM in en", () => {
    expect(formatAmount(12_500_000n, "en", { maximumFractionDigits: 2 })).toBe("1.25");
  });

  it("formats zero stroops", () => {
    expect(formatAmount(0n, "en")).toBe("0");
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

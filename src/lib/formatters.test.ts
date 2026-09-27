import { formatDate, formatRelativeTime, formatShortDate, formatTimeRange, formatXlm } from "@/lib/formatters";

describe("Native Intl Date Formatters (#1584)", () => {
  const ts = 1700000000; // Nov 14 2023

  it("formats short and full dates using Intl.DateTimeFormat", () => {
    const formatted = formatDate(ts, "en");
    expect(formatted).toMatch(/2023/);
    expect(formatShortDate(ts, "en")).toMatch(/2023/);
  });

  it("formats relative time natively using Intl.RelativeTimeFormat", () => {
    const nowMs = 1700000000000;
    const pastTs = ts - 86400 * 2; // 2 days ago

    const relative = formatRelativeTime(pastTs, "en", nowMs);
    expect(relative).toMatch(/2 days ago/);
  });

  it("formats date ranges using Intl.DateTimeFormat formatRange", () => {
    const start = ts;
    const end = ts + 86400 * 10;
    const range = formatTimeRange(start, end, "en");

    expect(range).toMatch(/Nov/);
    expect(range).toMatch(/2023/);
  });

  it("formats XLM amounts cleanly", () => {
    expect(formatXlm(1234.5678, "en")).toBe("1,234.57");
  });
});

/**
 * Unit tests for issue #1832 — account cache compares sequence numbers as strings.
 *
 * Sequence numbers are decimal strings, so a lexicographic comparison gives
 * wrong answers whenever the digit count changes ("10" < "9"). The cache must
 * compare them numerically.
 *
 * Run with: npx jest src/lib/contractClient.accountCache.test.ts --runInBand
 */

import { isSequenceAtLeast } from "./contractClient";

describe("isSequenceAtLeast (issue #1832)", () => {
  it("treats an equal sequence as stale-reuse (no refetch needed)", () => {
    expect(isSequenceAtLeast("9", "9")).toBe(true);
  });

  it("detects a bump across a digit-count change", () => {
    // "10" > "9" numerically, but "10" < "9" lexicographically.
    expect(isSequenceAtLeast("10", "9")).toBe(true);
    expect(isSequenceAtLeast("9", "10")).toBe(false);
  });

  it("handles larger multi-digit boundaries", () => {
    expect(isSequenceAtLeast("100", "99")).toBe(true);
    expect(isSequenceAtLeast("99", "100")).toBe(false);
    expect(isSequenceAtLeast("1000", "1000")).toBe(true);
  });

  it("handles a leading-zero-free numeric sequence pair", () => {
    expect(isSequenceAtLeast("2", "10")).toBe(false);
    expect(isSequenceAtLeast("2147483648", "2147483647")).toBe(true);
  });
});

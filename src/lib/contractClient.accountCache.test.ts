/**
 * Unit tests for issue #1832 — account cache sequence comparison must be numeric.
 */

import { __testUtils } from "./contractClient";

const { isSequenceCurrent } = __testUtils;

describe("isSequenceCurrent", () => {
  it("treats 10 as newer than 9 (string comparison would fail)", () => {
    expect(isSequenceCurrent("10", "9")).toBe(true);
  });

  it("treats 9 as older than 10", () => {
    expect(isSequenceCurrent("9", "10")).toBe(false);
  });

  it("returns true for equal sequences", () => {
    expect(isSequenceCurrent("9", "9")).toBe(true);
  });

  it("handles int64-sized sequence numbers across a digit boundary", () => {
    expect(isSequenceCurrent("10000000000000000000", "9999999999999999999")).toBe(true);
    expect(isSequenceCurrent("9999999999999999999", "10000000000000000000")).toBe(false);
  });
});

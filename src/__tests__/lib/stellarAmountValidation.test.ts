import { xlmToStroops, InvalidXlmAmountError } from "@/lib/stellarAmount";

describe("xlmToStroops input validation", () => {
  it.each(["-5", "-0.1", "abc", "1,5", "1.2.3", "1e3", " 1 2 ", "+5", "--1"])(
    "throws InvalidXlmAmountError for malformed input %p",
    (input) => {
      expect(() => xlmToStroops(input)).toThrow(InvalidXlmAmountError);
    },
  );

  it("throws for more than seven fractional digits", () => {
    expect(() => xlmToStroops("1.12345678")).toThrow(InvalidXlmAmountError);
  });

  it("still parses valid amounts", () => {
    expect(xlmToStroops("1")).toBe(10_000_000n);
    expect(xlmToStroops("1.25")).toBe(12_500_000n);
    expect(xlmToStroops("0.0000001")).toBe(1n);
    expect(xlmToStroops("")).toBe(0n);
  });
});

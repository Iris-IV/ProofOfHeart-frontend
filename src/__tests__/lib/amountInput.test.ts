import { sanitizeAmountInput } from "@/lib/amountInput";

describe("sanitizeAmountInput (fixes #619)", () => {
  it("strips a leading minus sign", () => {
    expect(sanitizeAmountInput("-5")).toBe("5");
    expect(sanitizeAmountInput("-0.5")).toBe("0.5");
  });

  it("strips minus signs anywhere in the value", () => {
    expect(sanitizeAmountInput("--5")).toBe("5");
    expect(sanitizeAmountInput("-")).toBe("");
  });

  it("leaves positive values untouched", () => {
    expect(sanitizeAmountInput("5")).toBe("5");
    expect(sanitizeAmountInput("1.5")).toBe("1.5");
    expect(sanitizeAmountInput("0.0000001")).toBe("0.0000001");
  });

  it("handles empty input", () => {
    expect(sanitizeAmountInput("")).toBe("");
  });
});

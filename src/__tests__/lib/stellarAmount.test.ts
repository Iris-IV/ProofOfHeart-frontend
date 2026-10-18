import {
  STROOPS_PER_XLM,
  stroopsToXlm,
  stroopsToXlmNumber,
  xlmToStroops,
} from "@/lib/stellarAmount";

describe("STROOPS_PER_XLM", () => {
  it("equals 10 million stroops per XLM", () => {
    expect(STROOPS_PER_XLM).toBe(10_000_000n);
  });
});

describe("stroopsToXlm", () => {
  it("converts zero", () => {
    expect(stroopsToXlm(0n)).toBe("0");
  });

  it("converts sub-1 XLM amounts without trailing zeros", () => {
    expect(stroopsToXlm(1n)).toBe("0.0000001");
    expect(stroopsToXlm(10_000n)).toBe("0.001");
  });

  it("converts whole XLM amounts", () => {
    expect(stroopsToXlm(STROOPS_PER_XLM)).toBe("1");
    expect(stroopsToXlm(12_500_000n)).toBe("1.25");
  });

  it("handles large stroop values via string math", () => {
    const large = 9_223_372_036_854_775_807n; // max i64 stroops
    expect(stroopsToXlm(large)).toBe("922337203685.4775807");
  });
});

describe("xlmToStroops", () => {
  it("parses empty as zero", () => {
    expect(xlmToStroops("")).toBe(0n);
    expect(xlmToStroops("   ")).toBe(0n);
  });

  it("parses integers and decimals", () => {
    expect(xlmToStroops("1")).toBe(STROOPS_PER_XLM);
    expect(xlmToStroops("1.25")).toBe(12_500_000n);
    expect(xlmToStroops("0.0000001")).toBe(1n);
  });

  it("pads and truncates fractional digits to 7 stroop decimals", () => {
    expect(xlmToStroops("1.2")).toBe(12_000_000n);
    expect(xlmToStroops("1.123456789")).toBe(11_234_567n);
  });
});

describe("stroopsToXlmNumber", () => {
  it("matches Number(stroopsToXlm()) for typical amounts", () => {
    expect(stroopsToXlmNumber(12_500_000n)).toBe(1.25);
  });
});

describe("round-trip", () => {
  it.each(["0", "0.1", "1", "12.5", "999.0000001"])(
    "preserves %s through stroopsToXlm and xlmToStroops",
    (xlm) => {
      expect(stroopsToXlm(xlmToStroops(xlm))).toBe(xlm);
    },
  );
});

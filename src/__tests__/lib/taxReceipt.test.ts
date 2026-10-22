import {
  PLACEHOLDER_TAX_ID,
  buildTaxReceiptHtml,
  downloadTaxReceipt,
  escapeHtml,
  getPlatformTaxId,
  getTaxReceiptFields,
  type TaxReceiptData,
} from "@/lib/taxReceipt";

const DATA: TaxReceiptData = {
  transactionHash: "a1b2c3d4e5f6",
  campaignTitle: "Clean Water for All",
  amountXlm: "10.5",
  donorAddress: "GDONOR1111111111111111111111111111111111111111111111111",
  donationDate: "2026-10-01T12:34:56.000Z",
};

const ISSUED_AT = new Date("2026-10-21T08:00:00.000Z");

/** jsdom's Blob has no `text()`; FileReader is supported. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsText(blob);
  });
}

describe("escapeHtml", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Clean Water 2026")).toBe("Clean Water 2026");
  });
});

describe("getPlatformTaxId", () => {
  const original = process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"];
  afterEach(() => {
    if (original === undefined) delete process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"];
    else process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"] = original;
  });

  it("falls back to the placeholder when unset or blank", () => {
    delete process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"];
    expect(getPlatformTaxId()).toBe(PLACEHOLDER_TAX_ID);
    process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"] = "   ";
    expect(getPlatformTaxId()).toBe(PLACEHOLDER_TAX_ID);
  });

  it("uses the trimmed configured value", () => {
    process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"] = " 12-3456789 ";
    expect(getPlatformTaxId()).toBe("12-3456789");
  });
});

describe("getTaxReceiptFields", () => {
  it("returns the rows in display order with UTC dates", () => {
    const fields = getTaxReceiptFields(DATA, ISSUED_AT);
    expect(fields.map((f) => [f.key, f.value])).toEqual([
      ["issueDate", "2026-10-21"],
      ["donationDate", "2026-10-01"],
      ["campaign", "Clean Water for All"],
      ["amount", "10.5 XLM"],
      ["donor", DATA.donorAddress],
      ["transaction", DATA.transactionHash],
    ]);
  });

  it("marks only machine identifiers as monospaced", () => {
    const mono = getTaxReceiptFields(DATA, ISSUED_AT)
      .filter((f) => f.mono)
      .map((f) => f.key);
    expect(mono).toEqual(["donor", "transaction"]);
  });

  it("defaults the issue date to now", () => {
    jest.useFakeTimers().setSystemTime(ISSUED_AT);
    try {
      expect(getTaxReceiptFields(DATA)[0]?.value).toBe("2026-10-21");
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("buildTaxReceiptHtml", () => {
  const original = process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"];
  afterEach(() => {
    if (original === undefined) delete process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"];
    else process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"] = original;
  });

  it("contains every receipt value and the configured Tax ID", () => {
    process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"] = "12-3456789";
    const html = buildTaxReceiptHtml(DATA, ISSUED_AT);
    for (const value of [
      "Clean Water for All",
      "10.5 XLM",
      DATA.donorAddress,
      DATA.transactionHash,
      "2026-10-01",
      "Generated on 2026-10-21",
      "Tax ID: 12-3456789",
    ]) {
      expect(html).toContain(value);
    }
    expect(html).not.toContain(PLACEHOLDER_TAX_ID);
  });

  it("shows the placeholder Tax ID only when none is configured", () => {
    delete process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"];
    expect(buildTaxReceiptHtml(DATA, ISSUED_AT)).toContain(`Tax ID: ${PLACEHOLDER_TAX_ID}`);
  });

  it("escapes markup in creator-supplied values", () => {
    const html = buildTaxReceiptHtml(
      { ...DATA, campaignTitle: `<img src=x onerror="alert(1)">` },
      ISSUED_AT,
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("contains no inline script so it runs under the CSP", () => {
    expect(buildTaxReceiptHtml(DATA, ISSUED_AT)).not.toMatch(/<script/i);
  });

  it("ships a print layout, a responsive breakpoint and a reduced-motion-safe entrance", () => {
    const html = buildTaxReceiptHtml(DATA, ISSUED_AT);
    expect(html).toContain("@media print");
    expect(html).toContain("@page");
    expect(html).toContain("@media (max-width: 480px)");
    expect(html).toMatch(/prefers-reduced-motion: no-preference[^}]*receipt-enter 120ms/);
  });
});

describe("downloadTaxReceipt", () => {
  const createObjectURL = jest.fn((_blob: Blob) => "blob:receipt");
  const revokeObjectURL = jest.fn();
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    openSpy = jest.spyOn(window, "open");
  });

  afterEach(() => {
    jest.useRealTimers();
    openSpy.mockRestore();
    jest.clearAllMocks();
  });

  it("opens the receipt, prints from the opener and revokes the URL after load", async () => {
    const popup = { focus: jest.fn(), print: jest.fn(), onload: null as null | (() => void) };
    openSpy.mockReturnValue(popup);

    downloadTaxReceipt(DATA);

    expect(openSpy).toHaveBeenCalledWith("blob:receipt", "_blank", "width=700,height=800");
    const blob = createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe("text/html");
    await expect(readBlob(blob)).resolves.toContain("Clean Water for All");
    expect(popup.print).not.toHaveBeenCalled();

    popup.onload?.();
    expect(popup.focus).toHaveBeenCalled();
    expect(popup.print).toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:receipt");
  });

  it("revokes the URL immediately when the pop-up is blocked", () => {
    openSpy.mockReturnValue(null);

    downloadTaxReceipt(DATA);

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:receipt");
  });
});

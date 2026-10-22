import { fireEvent, render, screen } from "@testing-library/react";
import TaxReceiptPreview from "@/components/TaxReceiptPreview";
import { downloadTaxReceipt, type TaxReceiptData } from "@/lib/taxReceipt";

jest.mock("@/lib/taxReceipt", () => ({
  ...jest.requireActual<typeof import("@/lib/taxReceipt")>("@/lib/taxReceipt"),
  downloadTaxReceipt: jest.fn(),
}));

const DATA: TaxReceiptData = {
  transactionHash: "abc123hash",
  campaignTitle: "Clean Water for All",
  amountXlm: "25",
  donorAddress: "GDONOR1111111111111111111111111111111111111111111111111",
  donationDate: "2026-10-01T12:00:00.000Z",
};

describe("TaxReceiptPreview", () => {
  const original = process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"];

  afterEach(() => {
    if (original === undefined) delete process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"];
    else process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"] = original;
    jest.clearAllMocks();
  });

  it("renders every receipt field under a labelled region", () => {
    render(<TaxReceiptPreview data={DATA} onBack={jest.fn()} />);

    expect(screen.getByRole("region", { name: "receiptTitle" })).toBeInTheDocument();
    for (const value of [
      "Clean Water for All",
      "25 XLM",
      DATA.donorAddress,
      DATA.transactionHash,
      "2026-10-01",
    ]) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    for (const label of [
      "issueDate",
      "donationDate",
      "campaign",
      "amount",
      "donor",
      "transaction",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("shows a dash for a missing donor address", () => {
    render(<TaxReceiptPreview data={{ ...DATA, donorAddress: "" }} onBack={jest.fn()} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("warns when the platform Tax ID is the placeholder", () => {
    delete process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"];
    render(<TaxReceiptPreview data={DATA} onBack={jest.fn()} />);
    expect(screen.getByText("placeholderTaxId")).toBeInTheDocument();
  });

  it("hides the warning when a Tax ID is configured", () => {
    process.env["NEXT_PUBLIC_PLATFORM_TAX_ID"] = "12-3456789";
    render(<TaxReceiptPreview data={DATA} onBack={jest.fn()} />);
    expect(screen.queryByText("placeholderTaxId")).not.toBeInTheDocument();
  });

  it("prints the same data and goes back on request", () => {
    const onBack = jest.fn();
    render(<TaxReceiptPreview data={DATA} onBack={onBack} />);

    fireEvent.click(screen.getByRole("button", { name: "print" }));
    expect(downloadTaxReceipt).toHaveBeenCalledWith(DATA);

    fireEvent.click(screen.getByRole("button", { name: "back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("skips the entrance animation under reduced motion", () => {
    (window.matchMedia as jest.Mock).mockImplementationOnce((query: string) => ({
      matches: true,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    render(<TaxReceiptPreview data={DATA} onBack={jest.fn()} />);
    expect(screen.getByTestId("tax-receipt-preview")).toBeInTheDocument();
  });
});

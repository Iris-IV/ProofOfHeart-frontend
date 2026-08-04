export interface TaxReceiptData {
  /** Stellar transaction hash */
  transactionHash: string;
  /** Campaign title */
  campaignTitle: string;
  /** Donation amount in XLM as a string (e.g. "10.5") */
  amountXlm: string;
  /** Donor's Stellar wallet address */
  donorAddress: string;
  /** ISO date string of the donation */
  donationDate: string;
}

const PLATFORM_NAME = "ProofOfHeart";
const PLATFORM_TAX_ID = process.env.NEXT_PUBLIC_PLATFORM_TAX_ID?.trim() || "XX-XXXXXXX";

/**
 * Opens a printable HTML tax receipt in a new window.
 * Zero dependencies — uses the browser's native print functionality.
 */
export function downloadTaxReceipt(data: TaxReceiptData): void {
  const generatedDate = new Date().toISOString().split("T")[0];
  const donationDate = data.donationDate.split("T")[0];
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Donation Tax Receipt</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; color: #1a1a1a; }
    h1 { font-size: 24px; text-align: center; margin-bottom: 4px; }
    .subtitle { text-align: center; font-size: 13px; color: #666; margin-bottom: 12px; }
    hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 6px 0; font-size: 14px; }
    td:first-child { font-weight: bold; width: 160px; vertical-align: top; }
    .footer { font-size: 11px; color: #888; margin-top: 16px; }
    @media print { body { margin: 0; padding: 20px; } }
  </style>
</head>
<body>
  <h1>Donation Tax Receipt</h1>
  <div class="subtitle">Issued by ${PLATFORM_NAME} &mdash; Tax ID: ${PLATFORM_TAX_ID}</div>
  <hr>
  <table>
    <tr><td>Receipt Issue Date</td><td>${generatedDate}</td></tr>
    <tr><td>Donation Date</td><td>${donationDate}</td></tr>
    <tr><td>Campaign</td><td>${data.campaignTitle}</td></tr>
    <tr><td>Donation Amount</td><td>${data.amountXlm} XLM</td></tr>
    <tr><td>Donor Address</td><td>${data.donorAddress}</td></tr>
    <tr><td>Transaction Hash</td><td>${data.transactionHash}</td></tr>
  </table>
  <hr>
  <div class="footer">
    <p>This receipt serves as an official record of your donation for tax purposes. Please retain this document for your records.</p>
    <p>Generated on ${generatedDate} by ${PLATFORM_NAME}.</p>
  </div>
  <script>window.print();</script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "width=700,height=800");
  if (w) {
    w.onload = () => {
      // Clean up the object URL after the window loads
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  } else {
    // Popup was blocked — revoke the URL immediately since it won't be used
    URL.revokeObjectURL(url);
  }
}

/**
 * Donation tax receipts (browser-only, no server round-trip, nothing stored).
 *
 * The receipt has two views built from the same field list
 * (`getTaxReceiptFields`):
 * - an in-app preview (`TaxReceiptPreview`, shown inside `DonationModal`);
 * - a printable document (`buildTaxReceiptHtml`) that `downloadTaxReceipt`
 *   opens in a new window from a `blob:` URL, then prompts the browser's print
 *   dialog so the donor can print it or save it as a PDF.
 *
 * Legal and security notes (details in `docs/TAX_RECEIPTS.md`):
 * - The issuer Tax ID comes from `NEXT_PUBLIC_PLATFORM_TAX_ID` and falls back to
 *   the placeholder `XX-XXXXXXX`; production must set the real value.
 * - The receipt states the amount in XLM only (no fiat value), identifies the
 *   donor by wallet address only, and carries no receipt number or signature.
 *   Whether it is valid for a deduction depends on jurisdiction and on the
 *   legal status of the issuer and recipient; it is not legal advice.
 * - Every interpolated value is HTML-escaped, and the document contains no
 *   inline script (printing is triggered from the opener), so it works under
 *   the production Content Security Policy.
 */
import { readClientEnv } from "./runtimeEnv";

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

export type TaxReceiptFieldKey =
  "issueDate" | "donationDate" | "campaign" | "amount" | "donor" | "transaction";

export interface TaxReceiptField {
  key: TaxReceiptFieldKey;
  /** English label used by the printable document (receipts are English-only). */
  label: string;
  value: string;
  /** Long machine identifiers (keys, hashes) are rendered monospaced and wrap anywhere. */
  mono: boolean;
}

export const PLATFORM_NAME = "ProofOfHeart";
export const PLACEHOLDER_TAX_ID = "XX-XXXXXXX";

export function getPlatformTaxId(): string {
  return readClientEnv()["NEXT_PUBLIC_PLATFORM_TAX_ID"]?.trim() || PLACEHOLDER_TAX_ID;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes `& < > " '` so creator-supplied text is rendered as text, never markup. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

function toIsoDate(value: string | Date): string {
  const iso = typeof value === "string" ? value : value.toISOString();
  return iso.split("T")[0] ?? iso;
}

/**
 * The receipt rows, in display order. Dates are UTC `YYYY-MM-DD`; the issue
 * date is `issuedAt` (the moment of generation by default).
 */
export function getTaxReceiptFields(
  data: TaxReceiptData,
  issuedAt: Date = new Date(),
): TaxReceiptField[] {
  return [
    { key: "issueDate", label: "Receipt Issue Date", value: toIsoDate(issuedAt), mono: false },
    {
      key: "donationDate",
      label: "Donation Date",
      value: toIsoDate(data.donationDate),
      mono: false,
    },
    { key: "campaign", label: "Campaign", value: data.campaignTitle, mono: false },
    { key: "amount", label: "Donation Amount", value: `${data.amountXlm} XLM`, mono: false },
    { key: "donor", label: "Donor Address", value: data.donorAddress, mono: true },
    { key: "transaction", label: "Transaction Hash", value: data.transactionHash, mono: true },
  ];
}

/**
 * Renders the self-contained printable receipt. On screen it is a frosted
 * card on a brand gradient with a short (120ms) entrance; in print it drops
 * to a plain black-on-white A4/Letter page. No external fonts, images or
 * scripts, so it works offline and under the CSP.
 */
export function buildTaxReceiptHtml(data: TaxReceiptData, issuedAt: Date = new Date()): string {
  const generatedDate = toIsoDate(issuedAt);
  const taxId = escapeHtml(getPlatformTaxId());
  const rows = getTaxReceiptFields(data, issuedAt)
    .map(
      (field) =>
        `      <div class="row"><dt>${escapeHtml(field.label)}</dt><dd${
          field.mono ? ' class="mono"' : ""
        }>${escapeHtml(field.value)}</dd></div>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Donation Tax Receipt</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      padding: clamp(12px, 4vw, 48px);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      color: #18181b;
      background: linear-gradient(135deg, #dbeafe 0%, #ede9fe 50%, #fce7f3 100%);
    }
    .receipt {
      max-width: 640px;
      margin: 0 auto;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.7);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.72);
      -webkit-backdrop-filter: blur(16px);
      backdrop-filter: blur(16px);
      box-shadow: 0 24px 48px -16px rgba(76, 29, 149, 0.25);
    }
    header {
      padding: clamp(16px, 4vw, 28px);
      color: #ffffff;
      background: linear-gradient(120deg, #2563eb 0%, #9333ea 100%);
    }
    h1 { margin: 0; font-size: clamp(20px, 2.5vw + 12px, 28px); line-height: 1.2; letter-spacing: -0.01em; }
    .subtitle { margin: 6px 0 0; font-size: clamp(12px, 0.5vw + 10px, 14px); opacity: 0.9; }
    dl { margin: 0; padding: clamp(12px, 3vw, 24px) clamp(16px, 4vw, 28px); }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 11rem) minmax(0, 1fr);
      gap: 4px 16px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(24, 24, 27, 0.08);
    }
    .row:last-child { border-bottom: none; }
    dt { font-size: 13px; font-weight: 600; color: #52525b; }
    dd { margin: 0; font-size: 14px; font-weight: 500; overflow-wrap: anywhere; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; }
    footer {
      padding: 14px clamp(16px, 4vw, 28px) clamp(16px, 4vw, 24px);
      font-size: 11.5px;
      line-height: 1.5;
      color: #52525b;
      border-top: 1px solid rgba(24, 24, 27, 0.08);
    }
    footer p { margin: 0 0 6px; }
    @media (max-width: 480px) {
      .row { grid-template-columns: minmax(0, 1fr); }
    }
    @media (prefers-reduced-motion: no-preference) {
      .receipt { animation: receipt-enter 120ms ease-out both; }
    }
    @keyframes receipt-enter {
      from { opacity: 0; transform: translateY(6px) scale(0.99); }
      to { opacity: 1; transform: none; }
    }
    @page { margin: 16mm; }
    @media print {
      body { padding: 0; background: #ffffff; }
      .receipt { max-width: none; border: none; border-radius: 0; background: #ffffff; box-shadow: none; backdrop-filter: none; animation: none; }
      header { color: #000000; background: none; border-bottom: 2px solid #000000; padding: 0 0 12px; }
      dl { padding: 8px 0; }
      footer { padding: 12px 0 0; color: #3f3f46; }
      .row { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="receipt">
    <header>
      <h1>Donation Tax Receipt</h1>
      <p class="subtitle">Issued by ${PLATFORM_NAME} &mdash; Tax ID: ${taxId}</p>
    </header>
    <dl>
${rows}
    </dl>
    <footer>
      <p>This receipt serves as an official record of your donation for tax purposes. Please retain this document for your records.</p>
      <p>Generated on ${generatedDate} by ${PLATFORM_NAME}.</p>
    </footer>
  </main>
</body>
</html>`;
}

/**
 * Opens the printable HTML tax receipt in a new window and prompts printing.
 * Zero dependencies — uses the browser's native print functionality.
 *
 * Must be called from a user gesture (otherwise the pop-up is blocked) and only
 * in the browser (`Blob`, `URL.createObjectURL`, `window.open`). When the
 * pop-up is blocked nothing is shown and the object URL is revoked at once;
 * otherwise `print()` is called from this (opener) window once the receipt has
 * loaded, and the URL is revoked one second later.
 */
export function downloadTaxReceipt(data: TaxReceiptData): void {
  const blob = new Blob([buildTaxReceiptHtml(data)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "width=700,height=800");
  if (w) {
    w.onload = () => {
      w.focus();
      w.print();
      // Clean up the object URL after the window loads
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  } else {
    // Popup was blocked — revoke the URL immediately since it won't be used
    URL.revokeObjectURL(url);
  }
}

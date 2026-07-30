import { ContributionHistoryItem } from "@/hooks/useContributions";
import { stroopsToXlmNumber } from "@/lib/stellarAmount";

/**
 * Escapes a cell string for CSV compliance according to RFC 4180.
 * Wraps in double quotes if commas, double quotes, or newlines are present.
 */
export function escapeCsvCell(cell: string | number): string {
  const str = String(cell ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats a millisecond timestamp into a clean YYYY-MM-DD HH:mm:ss date string.
 */
export function formatCsvDate(timestampMs: number): string {
  if (!timestampMs || isNaN(timestampMs)) return "";
  const d = new Date(timestampMs);
  return d.toISOString().replace("T", " ").substring(0, 19);
}

/**
 * Generates CSV string data for contribution history items.
 * Acceptance criteria columns: Campaign, Amount (XLM), Status, Transaction Hash, Date
 */
export function generateContributionHistoryCsv(contributions: ContributionHistoryItem[]): string {
  const headers = ["Campaign", "Amount (XLM)", "Status", "Transaction Hash", "Date"];

  const rows: string[][] = [];

  for (const item of contributions) {
    const title = item.campaign.title;
    const status = item.status;

    if (item.transactions && item.transactions.length > 0) {
      for (const tx of item.transactions) {
        const amountXlm = stroopsToXlmNumber(item.contribution);
        const dateStr = formatCsvDate(tx.timestamp);
        rows.push([title, amountXlm.toFixed(7).replace(/\.?0+$/, ""), status, tx.txHash, dateStr]);
      }
    } else {
      const amountXlm = stroopsToXlmNumber(item.contribution);
      const dateStr = formatCsvDate(item.campaign.created_at * 1000);
      rows.push([title, amountXlm.toFixed(7).replace(/\.?0+$/, ""), status, "N/A", dateStr]);
    }
  }

  const csvLines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];

  return csvLines.join("\r\n");
}

/**
 * Triggers a browser file download of the contribution history as CSV.
 * File name pattern: contributions_<truncatedWallet>_<YYYY-MM-DD>.csv
 */
export function exportContributionHistoryCsv(
  contributions: ContributionHistoryItem[],
  walletAddress: string,
): void {
  const csvContent = generateContributionHistoryCsv(contributions);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  const dateStr = new Date().toISOString().slice(0, 10);
  const truncatedWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}_${walletAddress.slice(-4)}`
    : "wallet";
  const filename = `contributions_${truncatedWallet}_${dateStr}.csv`;

  if (typeof window !== "undefined" && window.URL && window.document) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

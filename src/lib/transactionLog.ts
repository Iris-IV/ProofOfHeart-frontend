import { normalizeAddress } from "./stellar";
import { hasOffchainApiBaseUrl, requestOffchainJson } from "./offchainApiClient";
import {
  readAllEntries,
  writeAllEntries,
  appendTimestamp,
  filterAndSortByTimestamp,
} from "./logUtil";

export type WalletTransactionAction =
  | "contribute"
  | "claim_refund"
  | "claim_revenue"
  | "claim_reserve"
  | "deposit_revenue"
  | "withdraw"
  | "vote";

export interface WalletTransactionLogEntry {
  walletAddress: string;
  campaignId: number;
  action: WalletTransactionAction;
  txHash: string;
  timestamp: number;
}

const STORAGE_KEY = "proof_of_heart_wallet_tx_log_v1";

async function syncWalletTransaction(entry: WalletTransactionLogEntry): Promise<void> {
  if (!hasOffchainApiBaseUrl()) return;

  try {
    await requestOffchainJson("/wallet-transactions", {
      method: "POST",
      auth: {
        purpose: "wallet_transaction",
        payload: entry,
      },
      body: entry,
    });
  } catch {
    // Local history remains the source of truth if the backend is offline.
  }
}

export function appendWalletTransaction(entry: Omit<WalletTransactionLogEntry, "timestamp">): void {
  const normalizedEntry = appendTimestamp<WalletTransactionLogEntry>({
    ...entry,
    walletAddress: normalizeAddress(entry.walletAddress),
  });

  const allEntries = readAllEntries<WalletTransactionLogEntry>(STORAGE_KEY);
  allEntries.push(normalizedEntry);
  writeAllEntries(STORAGE_KEY, allEntries, 1000);
  void syncWalletTransaction(normalizedEntry);
}

export function getWalletTransactions(walletAddress: string): WalletTransactionLogEntry[] {
  return filterAndSortByTimestamp(
    readAllEntries<WalletTransactionLogEntry>(STORAGE_KEY),
    "walletAddress",
    walletAddress,
  );
}

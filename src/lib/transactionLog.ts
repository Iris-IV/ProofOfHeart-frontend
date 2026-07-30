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

import { normalizeAddress } from "./stellar";
import { hasOffchainApiBaseUrl, requestOffchainJson } from "./offchainApiClient";
import { readAllEntries, writeAllEntries } from "./localLog";

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
  const allEntries = readAllEntries<WalletTransactionLogEntry>(STORAGE_KEY);
  const normalizedEntry: WalletTransactionLogEntry = {
    ...entry,
    walletAddress: normalizeAddress(entry.walletAddress),
    timestamp: Date.now(),
  };

  allEntries.push(normalizedEntry);
  writeAllEntries(STORAGE_KEY, allEntries.slice(-1000));
  void syncWalletTransaction(normalizedEntry);
}

export function getWalletTransactions(walletAddress: string): WalletTransactionLogEntry[] {
  const normalizedAddress = normalizeAddress(walletAddress);
  return readAllEntries<WalletTransactionLogEntry>(STORAGE_KEY)
    .filter((entry) => normalizeAddress(entry.walletAddress) === normalizedAddress)
    .sort((a, b) => b.timestamp - a.timestamp);
}

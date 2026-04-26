export type WalletTransactionAction = 'contribute' | 'claim_refund' | 'claim_revenue' | 'vote';

export interface WalletTransactionLogEntry {
  walletAddress: string;
  campaignId: number;
  action: WalletTransactionAction;
  txHash: string;
  timestamp: number;
}

import { normalizeAddress } from './stellar';

const STORAGE_KEY = 'proof_of_heart_wallet_tx_log_v1';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readAllEntries(): WalletTransactionLogEntry[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as WalletTransactionLogEntry[];
  } catch {
    return [];
  }
}

function writeAllEntries(entries: WalletTransactionLogEntry[]): void {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore localStorage write failures.
  }
}

export function appendWalletTransaction(
  entry: Omit<WalletTransactionLogEntry, 'timestamp'>,
): void {
  const allEntries = readAllEntries();
  const normalizedEntry: WalletTransactionLogEntry = {
    ...entry,
    walletAddress: normalizeAddress(entry.walletAddress),
    timestamp: Date.now(),
  };

  allEntries.push(normalizedEntry);
  writeAllEntries(allEntries.slice(-1000));
}

export function getWalletTransactions(walletAddress: string): WalletTransactionLogEntry[] {
  const normalizedAddress = normalizeAddress(walletAddress);
  return readAllEntries()
    .filter((entry) => normalizeAddress(entry.walletAddress) === normalizedAddress)
    .sort((a, b) => b.timestamp - a.timestamp);
}

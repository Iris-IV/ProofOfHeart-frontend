// src/utils/explorer.ts

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';

export function explorerTxUrl(txHash: string): string {
  return `https://stellar.expert/explorer/${NETWORK}/tx/${txHash}`;
}

export function explorerAccountUrl(address: string): string {
  return `https://stellar.expert/explorer/${NETWORK}/account/${address}`;
}

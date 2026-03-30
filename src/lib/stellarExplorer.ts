const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';

export function getStellarExplorerTxUrl(txHash: string): string {
  const isTestnet = NETWORK_PASSPHRASE.toLowerCase().includes('test');
  const base = isTestnet
    ? 'https://stellar.expert/explorer/testnet/tx'
    : 'https://stellar.expert/explorer/public/tx';

  return `${base}/${txHash}`;
}

// src/utils/explorer.ts

/**
 * Derives the Stellar network identifier from the network passphrase.
 * Returns "public" for mainnet, "testnet" for testnet.
 */
function getNetworkFromPassphrase(): string {
  const passphrase =
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
  return passphrase.toLowerCase().includes("test") ? "testnet" : "public";
}

/**
 * Returns the base URL for Stellar Expert explorer based on the active network.
 */
export function getExplorerBase(): string {
  const network = getNetworkFromPassphrase();
  return `https://stellar.expert/explorer/${network}`;
}

/**
 * Returns the full URL for a transaction on Stellar Expert.
 */
export function explorerTxUrl(txHash: string): string {
  return `${getExplorerBase()}/tx/${txHash}`;
}

/**
 * Returns the full URL for an account on Stellar Expert.
 */
export function explorerAccountUrl(address: string): string {
  return `${getExplorerBase()}/account/${address}`;
}

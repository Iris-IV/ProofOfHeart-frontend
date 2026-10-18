/**
 * @deprecated Use explorerTxUrl from src/utils/explorer.ts instead.
 * This function is kept for backward compatibility.
 */
export function getStellarExplorerTxUrl(txHash: string): string {
  // Re-export from the centralized explorer utility
  const { explorerTxUrl } = require("../utils/explorer");
  return explorerTxUrl(txHash);
}

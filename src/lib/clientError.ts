/**
 * Shared error class for both off-chain API requests (offchainApiClient.ts)
 * and on-chain RPC interactions (contractClient.ts).
 * Aligning on this unified error shape allows consumers to handle errors consistently
 * without needing to branch based on the client used.
 */
export class ClientError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, options?: { status?: number; details?: unknown }) {
    super(message);
    this.name = "ClientError";
    this.status = options?.status;
    this.details = options?.details;
  }
}

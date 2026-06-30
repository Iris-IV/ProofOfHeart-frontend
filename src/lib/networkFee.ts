import { formatAmount } from "@/lib/formatters";
import { STROOPS_PER_XLM } from "@/lib/stellarAmount";
import * as StellarSdk from "@stellar/stellar-sdk";

/**
 * Conservative default for a single Soroban `contribute` invocation (stroops).
 * Real fees come from simulation during `assembleTransaction`; this is a pre-sign UI estimate.
 * Override via NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS when fee-bump strategy changes.
 */
export const DEFAULT_CONTRIBUTE_NETWORK_FEE_STROOPS = 100_000n;

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://soroban-testnet.stellar.org";

let _server: StellarSdk.rpc.Server | null = null;

function getServer(): StellarSdk.rpc.Server {
  if (!_server) {
    _server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
  }
  return _server;
}

let cachedFeeStroops: bigint | null = null;
let lastFetchedAt: number = 0;
const CACHE_TTL_MS = 30_000;

async function fetchFeeStats(): Promise<void> {
  const now = Date.now();
  if (cachedFeeStroops && now - lastFetchedAt < CACHE_TTL_MS) {
    return;
  }

  try {
    const server = getServer();
    const feeStats = await server.getFeeStats();
    const p90Fee = feeStats.feeCharged?.p90 ?? DEFAULT_CONTRIBUTE_NETWORK_FEE_STROOPS.toString();
    cachedFeeStroops = BigInt(p90Fee);
    lastFetchedAt = now;
  } catch {
    cachedFeeStroops = DEFAULT_CONTRIBUTE_NETWORK_FEE_STROOPS;
    lastFetchedAt = now;
  }
}

function parseEnvFeeStroops(): bigint | null {
  const raw = process.env.NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS;
  if (!raw?.trim()) return null;
  try {
    const parsed = BigInt(raw.trim());
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

/** Estimated network fee (stroops) debited from the contributor's account for a contribute tx. */
export async function getEstimatedContributeNetworkFeeStroops(): Promise<bigint> {
  const envFee = parseEnvFeeStroops();
  if (envFee) {
    return envFee;
  }
  await fetchFeeStats();
  return cachedFeeStroops ?? DEFAULT_CONTRIBUTE_NETWORK_FEE_STROOPS;
}

/** Estimated network fee in XLM for display. */
export async function getEstimatedContributeNetworkFeeXlm(): Promise<number> {
  return Number(await getEstimatedContributeNetworkFeeStroops()) / Number(STROOPS_PER_XLM);
}

export async function formatEstimatedNetworkFeeXlm(maximumFractionDigits = 7): Promise<string> {
  return formatAmount(await getEstimatedContributeNetworkFeeStroops(), "en", { maximumFractionDigits });
}

import { formatAmount } from "@/lib/formatters";
import { STROOPS_PER_XLM } from "@/lib/stellarAmount";

/**
 * Conservative default for a single Soroban `contribute` invocation (stroops).
 * Serves as the RPC-failure fallback: when the dynamic fee-estimation call is
 * unavailable, this value is used for the pre-sign UI estimate.
 *
 * Once issue #618 is resolved (dynamic fee via RPC), this fallback is expected
 * to change or become a true RPC-failure fallback.
 *
 * Override via NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS when fee-bump strategy changes.
 */
export const DEFAULT_CONTRIBUTE_NETWORK_FEE_STROOPS = 100_000n;

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
export function getEstimatedContributeNetworkFeeStroops(): bigint {
  return parseEnvFeeStroops() ?? DEFAULT_CONTRIBUTE_NETWORK_FEE_STROOPS;
}

/** Estimated network fee in XLM for display. */
export function getEstimatedContributeNetworkFeeXlm(): number {
  return Number(getEstimatedContributeNetworkFeeStroops()) / Number(STROOPS_PER_XLM);
}

export function formatEstimatedNetworkFeeXlm(maximumFractionDigits = 7): string {
  return formatAmount(getEstimatedContributeNetworkFeeStroops(), "en", { maximumFractionDigits });
}

/** CPU/memory resource limits requested for a Soroban transaction. */
export interface SorobanResourceLimits {
  /** CPU instructions. */
  instructions: number;
  /** Bytes of ledger entries read. */
  readBytes: number;
  /** Bytes of ledger entries written. */
  writeBytes: number;
}

/**
 * Conservative fallback used when a simulation footprint is unavailable, so a
 * complex multi-operation transaction still has room to execute instead of
 * failing on the default (minimal) limits.
 */
export const DEFAULT_SOROBAN_RESOURCE_LIMITS: SorobanResourceLimits = {
  instructions: 2_000_000,
  readBytes: 20_000,
  writeBytes: 10_000,
};

/** Headroom added on top of the simulated footprint (10%). */
export const RESOURCE_LIMIT_HEADROOM_MULTIPLIER = 1.1;

/**
 * Derive the CPU/memory resource limits to request from a transaction's
 * simulated footprint (`SorobanTransactionData.resources()`), padding each
 * dimension by a safety multiplier so the transaction survives a footprint
 * that grows slightly between simulation and execution. Missing or non-finite
 * dimensions fall back to {@link DEFAULT_SOROBAN_RESOURCE_LIMITS}.
 *
 * Pre-simulating (via `simulateTransaction`) and feeding its footprint here is
 * preferred over the flat defaults for complex multi-operation transactions.
 */
export function computeResourceLimits(
  footprint: Partial<SorobanResourceLimits>,
  options?: { headroomMultiplier?: number; fallback?: SorobanResourceLimits },
): SorobanResourceLimits {
  const fallback = options?.fallback ?? DEFAULT_SOROBAN_RESOURCE_LIMITS;
  const headroom = options?.headroomMultiplier ?? RESOURCE_LIMIT_HEADROOM_MULTIPLIER;

  const scale = (simulated: number | undefined, fallbackValue: number): number => {
    if (typeof simulated !== "number" || !Number.isFinite(simulated) || simulated <= 0) {
      return fallbackValue;
    }
    return Math.ceil(simulated * headroom);
  };

  return {
    instructions: scale(footprint.instructions, fallback.instructions),
    readBytes: scale(footprint.readBytes, fallback.readBytes),
    writeBytes: scale(footprint.writeBytes, fallback.writeBytes),
  };
}

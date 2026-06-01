import { formatStroopsAsXlm } from "@/types";

const STROOPS_PER_XLM = 10_000_000n;

/**
 * Conservative default for a single Soroban `contribute` invocation (stroops).
 * Real fees come from simulation during `assembleTransaction`; this is a pre-sign UI estimate.
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
  return formatStroopsAsXlm(getEstimatedContributeNetworkFeeStroops(), { maximumFractionDigits });
}

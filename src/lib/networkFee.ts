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

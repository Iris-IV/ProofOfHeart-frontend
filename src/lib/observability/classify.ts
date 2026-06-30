import { getContractErrorCode, contractErrorKey } from "@/utils/contractErrors";
import type { ObservabilityCategory, ObservabilityKind } from "./types";

export interface ClassifiedFailure {
  category: ObservabilityCategory;
  kind: ObservabilityKind;
  contractErrorCode?: number;
  contractErrorKey?: string;
  message: string;
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("aborted") ||
    message.includes("deadline")
  );
}

export function classifySimulationFailure(error: unknown, operation?: string): ClassifiedFailure {
  const code = getContractErrorCode(error);
  if (code !== null) {
    return {
      category: "contract",
      kind: "contract_error",
      contractErrorCode: code,
      contractErrorKey: contractErrorKey(code),
      message: error instanceof Error ? error.message : String(error),
    };
  }
  return {
    category: "transaction",
    kind: "simulation_failure",
    message:
      error instanceof Error
        ? error.message
        : `Simulation failed${operation ? ` (${operation})` : ""}`,
  };
}

export function classifyRpcFailure(error: unknown, operation: string): ClassifiedFailure {
  const code = getContractErrorCode(error);
  if (code !== null) {
    return {
      category: "contract",
      kind: "contract_error",
      contractErrorCode: code,
      contractErrorKey: contractErrorKey(code),
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (isTimeoutError(error)) {
    return {
      category: "rpc",
      kind: "rpc_timeout",
      message: error instanceof Error ? error.message : `RPC timeout (${operation})`,
    };
  }
  return {
    category: "rpc",
    kind: "rpc_error",
    message: error instanceof Error ? error.message : `RPC error (${operation})`,
  };
}

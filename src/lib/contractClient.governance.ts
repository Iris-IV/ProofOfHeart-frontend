import {
  Contract,
  nativeToScVal,
  Address,
} from "@stellar/stellar-sdk";
import { getSignerAddress } from "./walletSigner";
import { parseContractError } from "../utils/contractErrors";
import { buildAndSubmitTransaction, emitMockLifecycle, TransactionLifecycleOptions } from "./contractClient";

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

export async function setVotingParams(
  quorum: number,
  threshold: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (quorum < 1 || quorum > 1000) {
    throw new Error("Quorum must be between 1 and 1000");
  }
  if (threshold < 10 || threshold > 100) {
    throw new Error("Threshold must be between 10 and 100");
  }

  if (USE_MOCKS) return emitMockLifecycle("mock_tx_set_voting_params", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "set_voting_params",
    nativeToScVal(quorum, { type: "u32" }),
    nativeToScVal(threshold, { type: "u32" }),
  );

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "set_voting_params",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function setMinVotingBalance(
  balance: bigint,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (balance < 0n) {
    throw new Error("Minimum voting balance must be positive");
  }

  if (USE_MOCKS) return emitMockLifecycle("mock_tx_set_min_voting_balance", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "set_min_voting_balance",
    nativeToScVal(balance, { type: "i128" }),
  );

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "set_min_voting_balance",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function setCategoryVotingThreshold(
  category: number,
  threshold: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (category < 0 || category > 255) {
    throw new Error("Invalid category (must be 0-255)");
  }
  if (threshold < 10 || threshold > 100) {
    throw new Error("Threshold must be between 10 and 100");
  }

  if (USE_MOCKS) return emitMockLifecycle("mock_tx_set_category_voting_threshold", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "set_category_voting_threshold",
    nativeToScVal(category, { type: "u8" }),
    nativeToScVal(threshold, { type: "u32" }),
  );

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "set_category_voting_threshold",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function removeCategoryVotingThreshold(
  category: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (category < 0 || category > 255) {
    throw new Error("Invalid category (must be 0-255)");
  }

  if (USE_MOCKS) return emitMockLifecycle("mock_tx_remove_category_voting_threshold", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "remove_category_voting_threshold",
    nativeToScVal(category, { type: "u8" }),
  );

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "remove_category_voting_threshold",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function purgeVotingState(
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (USE_MOCKS) return emitMockLifecycle("mock_tx_purge_voting_state", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call("purge_voting_state");

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "purge_voting_state",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

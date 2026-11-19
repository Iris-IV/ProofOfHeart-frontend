import {
  Contract,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { getSignerAddress } from "./walletSigner";
import { parseContractError } from "../utils/contractErrors";
import { buildAndSubmitTransaction, emitMockLifecycle, TransactionLifecycleOptions } from "./contractClient";

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

export async function setCampaignFeeOverride(
  campaignId: number,
  feeBps: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (campaignId < 0) {
    throw new Error("Campaign ID must be positive");
  }
  if (feeBps < 0 || feeBps > 10000) {
    throw new Error("Fee must be between 0 and 10000 basis points");
  }

  if (USE_MOCKS) return emitMockLifecycle("mock_tx_set_campaign_fee_override", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "set_campaign_fee_override",
    nativeToScVal(campaignId, { type: "u32" }),
    nativeToScVal(feeBps, { type: "u32" }),
  );

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "set_campaign_fee_override",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function setCategoryDurationCap(
  category: number,
  days: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (category < 0 || category > 255) {
    throw new Error("Invalid category (must be 0-255)");
  }
  if (days <= 0) {
    throw new Error("Duration cap must be positive");
  }

  if (USE_MOCKS) return emitMockLifecycle("mock_tx_set_category_duration_cap", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "set_category_duration_cap",
    nativeToScVal(category, { type: "u8" }),
    nativeToScVal(days, { type: "u32" }),
  );

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "set_category_duration_cap",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function removeCategoryDurationCap(
  category: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (category < 0 || category > 255) {
    throw new Error("Invalid category (must be 0-255)");
  }

  if (USE_MOCKS) return emitMockLifecycle("mock_tx_remove_category_duration_cap", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "remove_category_duration_cap",
    nativeToScVal(category, { type: "u8" }),
  );

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "remove_category_duration_cap",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function setMinCampaignFundingGoal(
  amount: bigint,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (amount < 0n) {
    throw new Error("Minimum funding goal must be positive");
  }

  if (USE_MOCKS) return emitMockLifecycle("mock_tx_set_min_campaign_funding_goal", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "set_min_campaign_funding_goal",
    nativeToScVal(amount, { type: "i128" }),
  );

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "set_min_campaign_funding_goal",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function setMaxCampaignFundingGoal(
  amount: bigint,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (amount < 0n) {
    throw new Error("Maximum funding goal must be positive");
  }

  if (USE_MOCKS) return emitMockLifecycle("mock_tx_set_max_campaign_funding_goal", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "set_max_campaign_funding_goal",
    nativeToScVal(amount, { type: "i128" }),
  );

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "set_max_campaign_funding_goal",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function setMaxContributionPerTx(
  amount: bigint,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (amount < 0n) {
    throw new Error("Max contribution per transaction must be positive");
  }

  if (USE_MOCKS) return emitMockLifecycle("mock_tx_set_max_contribution_per_tx", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "set_max_contribution_per_tx",
    nativeToScVal(amount, { type: "i128" }),
  );

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "set_max_contribution_per_tx",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function setCancellationPenaltyBps(
  bps: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (bps < 0 || bps > 10000) {
    throw new Error("Cancellation penalty must be between 0 and 10000 basis points");
  }

  if (USE_MOCKS) return emitMockLifecycle("mock_tx_set_cancellation_penalty_bps", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "set_cancellation_penalty_bps",
    nativeToScVal(bps, { type: "u32" }),
  );

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "set_cancellation_penalty_bps",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

export async function setVestingParams(
  vestingDelay: number,
  vestingCliff: number,
  options?: TransactionLifecycleOptions,
): Promise<string> {
  if (vestingDelay < 0 || vestingCliff < 0) {
    throw new Error("Vesting delay and cliff must be non-negative");
  }

  if (USE_MOCKS) return emitMockLifecycle("mock_tx_set_vesting_params", options);

  const callerAddress = await getSignerAddress();
  const contract = new Contract(CONTRACT_ADDRESS);
  const op = contract.call(
    "set_vesting_params",
    nativeToScVal(vestingDelay, { type: "u32" }),
    nativeToScVal(vestingCliff, { type: "u32" }),
  );

  try {
    const txResult = await buildAndSubmitTransaction(callerAddress, op, {
      ...options,
      operation: "set_vesting_params",
    });
    return txResult.txHash;
  } catch (err) {
    throw new Error(parseContractError(err));
  }
}

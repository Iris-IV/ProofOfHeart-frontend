import { Keypair, Transaction, TransactionBuilder, BASE_FEE } from "@stellar/stellar-sdk";
import { signTransactionXdr } from "./walletSigner";

/**
 * Multi-signature authorization data for a campaign cancellation.
 * #1508: Multi-Sig Authorization Signature Aggregator for Campaign Cancellation
 */
export interface MultiSigSignature {
  signer: string;
  signatureXdr: string;
  timestamp: number;
}

export interface MultiSigAggregatorState {
  campaignId: number;
  requiredSignatures: number;
  collectedSignatures: MultiSigSignature[];
  isComplete: boolean;
  transactionXdr?: string;
}

/**
 * Aggregates signatures from multiple signers for campaign cancellation.
 * Handles signature collection, validation, and aggregation for multi-sig scenarios.
 */
export class MultiSigAggregator {
  private state: Map<number, MultiSigAggregatorState> = new Map();

  /**
   * Initialize multi-sig collection for a campaign.
   */
  initiateCampaignCancellation(
    campaignId: number,
    requiredSignatures: number,
  ): MultiSigAggregatorState {
    const state: MultiSigAggregatorState = {
      campaignId,
      requiredSignatures,
      collectedSignatures: [],
      isComplete: false,
    };
    this.state.set(campaignId, state);
    return state;
  }

  /**
   * Add a signature from a signer.
   * Validates signer uniqueness and checks if we have all required signatures.
   */
  addSignature(campaignId: number, signer: string, signatureXdr: string): MultiSigAggregatorState {
    const state = this.state.get(campaignId);
    if (!state) {
      throw new Error(`No multi-sig session for campaign ${campaignId}`);
    }

    // Check for duplicate signatures from same signer
    if (state.collectedSignatures.some((sig) => sig.signer === signer)) {
      throw new Error(`Signature from ${signer} already collected`);
    }

    // Add signature
    state.collectedSignatures.push({
      signer,
      signatureXdr,
      timestamp: Date.now(),
    });

    // Check if we have all required signatures
    if (state.collectedSignatures.length >= state.requiredSignatures) {
      state.isComplete = true;
    }

    return state;
  }

  /**
   * Get current state of multi-sig collection.
   */
  getState(campaignId: number): MultiSigAggregatorState | null {
    return this.state.get(campaignId) ?? null;
  }

  /**
   * Combine collected signatures into a multi-sig transaction.
   * All required signatures must be present.
   */
  aggregateSignatures(
    campaignId: number,
    baseTransaction: Transaction,
  ): { transaction: Transaction; signatures: MultiSigSignature[] } {
    const state = this.state.get(campaignId);
    if (!state) {
      throw new Error(`No multi-sig session for campaign ${campaignId}`);
    }

    if (!state.isComplete) {
      throw new Error(
        `Insufficient signatures: ${state.collectedSignatures.length}/${state.requiredSignatures}`,
      );
    }

    // Create new transaction with all collected signatures
    const aggregatedTx = baseTransaction.cloneWithSignatures(
      ...state.collectedSignatures.map((sig) => Buffer.from(sig.signatureXdr, "base64")),
    );

    return {
      transaction: aggregatedTx,
      signatures: state.collectedSignatures,
    };
  }

  /**
   * Clear the state for a campaign (after successful submission).
   */
  clearSession(campaignId: number): void {
    this.state.delete(campaignId);
  }

  /**
   * Get all pending multi-sig sessions.
   */
  getPendingSessions(): MultiSigAggregatorState[] {
    return Array.from(this.state.values()).filter((state) => !state.isComplete);
  }

  /**
   * Cancel a multi-sig session (e.g., timeout or user cancellation).
   */
  cancelSession(campaignId: number, reason: string): void {
    console.warn(`Multi-sig session cancelled for campaign ${campaignId}: ${reason}`);
    this.clearSession(campaignId);
  }
}

/**
 * Global instance of multi-sig aggregator.
 */
export const multiSigAggregator = new MultiSigAggregator();

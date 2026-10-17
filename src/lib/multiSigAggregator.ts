import { Transaction } from "@stellar/stellar-sdk";

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
}

export class MultiSigAggregator {
  private state: Map<number, MultiSigAggregatorState> = new Map();

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

  addSignature(campaignId: number, signer: string, signatureXdr: string): MultiSigAggregatorState {
    const state = this.state.get(campaignId);
    if (!state) throw new Error(`No multi-sig session for campaign ${campaignId}`);

    if (state.collectedSignatures.some((sig) => sig.signer === signer)) {
      throw new Error(`Signature from ${signer} already collected`);
    }

    state.collectedSignatures.push({ signer, signatureXdr, timestamp: Date.now() });

    if (state.collectedSignatures.length >= state.requiredSignatures) {
      state.isComplete = true;
    }

    return state;
  }

  getState(campaignId: number): MultiSigAggregatorState | null {
    return this.state.get(campaignId) ?? null;
  }

  aggregateSignatures(
    campaignId: number,
    baseTransaction: Transaction,
  ): { transaction: Transaction; signatures: MultiSigSignature[] } {
    const state = this.state.get(campaignId);
    if (!state) throw new Error(`No multi-sig session for campaign ${campaignId}`);

    if (!state.isComplete) {
      throw new Error(
        `Insufficient signatures: ${state.collectedSignatures.length}/${state.requiredSignatures}`,
      );
    }

    const aggregatedTx = baseTransaction.cloneWithSignatures(
      ...state.collectedSignatures.map((sig) => Buffer.from(sig.signatureXdr, "base64")),
    );

    return { transaction: aggregatedTx, signatures: state.collectedSignatures };
  }

  clearSession(campaignId: number): void {
    this.state.delete(campaignId);
  }

  getPendingSessions(): MultiSigAggregatorState[] {
    return Array.from(this.state.values()).filter((s) => !s.isComplete);
  }

  cancelSession(campaignId: number, reason: string): void {
    console.warn(`Multi-sig session cancelled for campaign ${campaignId}: ${reason}`);
    this.clearSession(campaignId);
  }
}

export const multiSigAggregator = new MultiSigAggregator();

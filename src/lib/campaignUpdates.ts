import * as StellarSdk from "@stellar/stellar-sdk";
import { CampaignUpdate, UpdatePayload } from "../types";
import { parseContractError } from "../utils/contractErrors";
import {
  hasOffchainApiBaseUrl,
  requestOffchainJson,
  signOffchainPayload,
} from "./offchainApiClient";

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

// ---------------------------------------------------------------------------
// Mock data for campaign updates
// ---------------------------------------------------------------------------

const MOCK_UPDATES: Record<number, CampaignUpdate[]> = {
  1: [
    {
      id: "update-1-1",
      campaignId: 1,
      content: "We've successfully completed the first phase of our clean water project! 200 families now have access to clean drinking water thanks to your support. The next phase will focus on extending the pipeline to the remaining 300 families.",
      authorAddress: "GABC123456789012345678901234567890123456789012345678901234567890",
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 5,
      signature: "mock-signature-update-1-1",
    },
    {
      id: "update-1-2",
      campaignId: 1,
      content: "Thank you all for the incredible support! We've reached 50% of our funding goal. The community response has been overwhelming, and we're excited to continue making progress.",
      authorAddress: "GABC123456789012345678901234567890123456789012345678901234567890",
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 10,
      signature: "mock-signature-update-1-2",
    },
  ],
  2: [
    {
      id: "update-2-1",
      campaignId: 2,
      content: "Great news! We've partnered with TechForGood Foundation to provide tablets for all students. The first batch of 50 tablets has arrived and will be distributed next week.",
      authorAddress: "GDEF123456789012345678901234567890123456789012345678901234567890",
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 3,
      signature: "mock-signature-update-2-1",
    },
  ],
};

// ---------------------------------------------------------------------------
// Helper: Sign a payload using Freighter wallet
// ---------------------------------------------------------------------------

async function signPayload(payload: UpdatePayload): Promise<string> {
  try {
    const { signature } = await signOffchainPayload(payload, "update_signature");
    return signature;
  } catch (error) {
    throw new Error(`Failed to sign payload: ${parseContractError(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Public API — Fetch updates for a campaign
// ---------------------------------------------------------------------------

/**
 * Fetches all updates for a specific campaign.
 * Updates are returned in reverse chronological order (newest first).
 */
export async function getCampaignUpdates(campaignId: number): Promise<CampaignUpdate[]> {
  if (USE_MOCKS || !hasOffchainApiBaseUrl()) {
    // Return mock updates or empty array
    return MOCK_UPDATES[campaignId] ?? [];
  }

  try {
    const updates = await requestOffchainJson<CampaignUpdate[]>(`/campaigns/${campaignId}/updates`);

    // Sort by timestamp descending (newest first)
    return updates.sort((a: CampaignUpdate, b: CampaignUpdate) => b.timestamp - a.timestamp);
  } catch (error) {
    throw new Error(`Failed to fetch campaign updates: ${parseContractError(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Public API — Create a new update
// ---------------------------------------------------------------------------

/**
 * Creates a new campaign update.
 * Only the campaign creator can post updates.
 * The payload is signed by the creator's wallet for verification.
 */
export async function createCampaignUpdate(
  campaignId: number,
  content: string,
  creatorAddress: string,
  notify: boolean = false
): Promise<CampaignUpdate> {
  if (USE_MOCKS || !hasOffchainApiBaseUrl()) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    const timestamp = Math.floor(Date.now() / 1000);
    const payload: UpdatePayload = { campaignId, content, timestamp };
    const signature = await signPayload(payload);
    
    const newUpdate: CampaignUpdate = {
      id: `update-${campaignId}-${Date.now()}`,
      campaignId,
      content,
      authorAddress: creatorAddress,
      timestamp,
      signature,
    };
    
    // Log notify action (mock behavior)
    if (notify) {
      console.log(`[Mock] Notification sent to contributors for campaign ${campaignId}`);
    }
    
    // Add to mock data
    if (!MOCK_UPDATES[campaignId]) {
      MOCK_UPDATES[campaignId] = [];
    }
    MOCK_UPDATES[campaignId].unshift(newUpdate);
    
    return newUpdate;
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload: UpdatePayload = { campaignId, content, timestamp };

    // Sign the payload
    const signature = await signPayload(payload);

    return await requestOffchainJson<CampaignUpdate>(`/campaigns/${campaignId}/updates`, {
      method: "POST",
      auth: {
        purpose: "create_campaign_update",
        payload: {
          campaignId,
          content,
          authorAddress: creatorAddress,
          timestamp,
          signature,
          notify,
        },
      },
      body: {
        campaignId,
        content,
        authorAddress: creatorAddress,
        timestamp,
        signature,
        notify,
      },
    });
  } catch (error) {
    throw new Error(`Failed to create campaign update: ${parseContractError(error)}`);
  }
}

/**
 * Verifies that an update was signed by the claimed author.
 * This can be used client-side for validation or server-side.
 */
export async function verifyUpdateSignature(update: CampaignUpdate): Promise<boolean> {
  if (USE_MOCKS) {
    return update.signature.startsWith("mock-signature");
  }

  try {
    // Reconstruct the payload that was signed
    const payloadString = JSON.stringify({
      campaignId: update.campaignId,
      content: update.content,
      timestamp: update.timestamp,
    });
    
    const payloadHash = StellarSdk.hash(Buffer.from(payloadString));
    const signature = Buffer.from(update.signature, "hex");
    const publicKey = StellarSdk.StrKey.decodeEd25519PublicKey(update.authorAddress);
    
    const verified = StellarSdk.verify(
      payloadHash,
      signature,
      publicKey
    );
    
    return verified;
  } catch {
    return false;
  }
}

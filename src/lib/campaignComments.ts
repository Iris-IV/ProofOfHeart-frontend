import * as StellarSdk from "@stellar/stellar-sdk";
import { Comment, CommentPayload } from "../types";
import { parseContractError } from "../utils/contractErrors";
import {
  hasOffchainApiBaseUrl,
  requestOffchainJson,
  signOffchainPayload,
} from "./offchainApiClient";

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

// ---------------------------------------------------------------------------
// Mock data for campaign comments
// ---------------------------------------------------------------------------

const MOCK_COMMENTS: Record<number, Comment[]> = {
  1: [
    {
      id: "comment-1-1",
      campaignId: 1,
      content: "Is this water project going to use solar or grid power?",
      authorAddress: "GBVABC12345678901234567890123456789012345678901234567890",
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 2,
      parentId: null,
      signature: "mock-sig",
      isPinned: false,
      isReported: false,
    },
    {
      id: "comment-1-2",
      campaignId: 1,
      content: "Great question! We will be using solar power to ensure sustainability.",
      authorAddress: "GABC123456789012345678901234567890123456789012345678901234567890",
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 1,
      parentId: "comment-1-1",
      signature: "mock-sig",
      isPinned: true,
      isReported: false,
    },
    {
      id: "comment-1-3",
      campaignId: 1,
      content: "This is really inspiring!",
      authorAddress: "GDDEF12345678901234567890123456789012345678901234567890",
      timestamp: Math.floor(Date.now() / 1000) - 3600 * 5,
      parentId: null,
      signature: "mock-sig",
      isPinned: false,
      isReported: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// Helper: Sign a payload using Freighter wallet
// ---------------------------------------------------------------------------

async function signPayload(payload: CommentPayload): Promise<string> {
  try {
    const { signature } = await signOffchainPayload(payload, "comment_signature");
    return signature;
  } catch (error) {
    throw new Error(`Failed to sign payload: ${parseContractError(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getCampaignComments(campaignId: number): Promise<Comment[]> {
  if (USE_MOCKS || !hasOffchainApiBaseUrl()) {
    return MOCK_COMMENTS[campaignId] ?? [];
  }

  try {
    return await requestOffchainJson<Comment[]>(`/campaigns/${campaignId}/comments`);
  } catch (error) {
    throw new Error(`Failed to fetch comments: ${parseContractError(error)}`);
  }
}

export async function createCampaignComment(
  campaignId: number,
  content: string,
  authorAddress: string,
  parentId: string | null = null
): Promise<Comment> {
  if (USE_MOCKS || !hasOffchainApiBaseUrl()) {
    await new Promise((resolve) => setTimeout(resolve, 800));

    const timestamp = Math.floor(Date.now() / 1000);
    const payload: CommentPayload = { campaignId, content, timestamp };
    const signature = await signPayload(payload);

    const newComment: Comment = {
      id: `comment-${campaignId}-${Date.now()}`,
      campaignId,
      content,
      authorAddress,
      timestamp,
      parentId,
      signature,
      isPinned: false,
      isReported: false,
    };

    if (!MOCK_COMMENTS[campaignId]) {
      MOCK_COMMENTS[campaignId] = [];
    }
    MOCK_COMMENTS[campaignId].push(newComment);

    return newComment;
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload: CommentPayload = { campaignId, content, timestamp };

    const signature = await signPayload(payload);

    return await requestOffchainJson<Comment>(`/campaigns/${campaignId}/comments`, {
      method: "POST",
      auth: {
        purpose: "create_campaign_comment",
        payload: {
          campaignId,
          content,
          authorAddress,
          timestamp,
          parentId,
          signature,
        },
      },
      body: {
        campaignId,
        content,
        authorAddress,
        timestamp,
        parentId,
        signature,
      },
    });
  } catch (error) {
    throw new Error(`Failed to create comment: ${parseContractError(error)}`);
  }
}

export async function pinComment(campaignId: number, commentId: string, isPinned: boolean): Promise<Comment> {
  if (USE_MOCKS || !hasOffchainApiBaseUrl()) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const comments = MOCK_COMMENTS[campaignId] || [];
    const commentIndex = comments.findIndex(c => c.id === commentId);
    if (commentIndex !== -1) {
      comments[commentIndex] = { ...comments[commentIndex], isPinned };
      return comments[commentIndex];
    }
    throw new Error("Comment not found");
  }

  try {
    return await requestOffchainJson<Comment>(`/campaigns/${campaignId}/comments/${commentId}/pin`, {
      method: "POST",
      auth: {
        purpose: "pin_comment",
        payload: { campaignId, commentId, isPinned },
      },
      body: { isPinned },
    });
  } catch (error) {
    throw new Error(`Failed to pin comment: ${parseContractError(error)}`);
  }
}

export async function reportComment(campaignId: number, commentId: string): Promise<Comment> {
  if (USE_MOCKS || !hasOffchainApiBaseUrl()) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const comments = MOCK_COMMENTS[campaignId] || [];
    const commentIndex = comments.findIndex(c => c.id === commentId);
    if (commentIndex !== -1) {
      comments[commentIndex] = { ...comments[commentIndex], isReported: true };
      return comments[commentIndex];
    }
    throw new Error("Comment not found");
  }

  try {
    return await requestOffchainJson<Comment>(`/campaigns/${campaignId}/comments/${commentId}/report`, {
      method: "POST",
      auth: {
        purpose: "report_comment",
        payload: { campaignId, commentId },
      },
    });
  } catch (error) {
    throw new Error(`Failed to report comment: ${parseContractError(error)}`);
  }
}

export async function verifyCommentSignature(comment: Comment): Promise<boolean> {
  if (USE_MOCKS) {
    return comment.signature.startsWith("mock-sig");
  }

  try {
    const payloadString = JSON.stringify({
      campaignId: comment.campaignId,
      content: comment.content,
      timestamp: comment.timestamp,
    });

    const payloadHash = StellarSdk.hash(Buffer.from(payloadString));
    const signatureBuffer = Buffer.from(comment.signature, "hex");
    const publicKey = StellarSdk.StrKey.decodeEd25519PublicKey(comment.authorAddress);
    
    return StellarSdk.verify(
      payloadHash,
      signatureBuffer,
      publicKey
    );
  } catch {
    return false;
  }
}

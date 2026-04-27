import { signTransaction, getAddress } from "@stellar/freighter-api";
import * as StellarSdk from "@stellar/stellar-sdk";
import { Comment, CommentPayload } from "../types";
import { parseContractError } from "../utils/contractErrors";

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

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
    const { address } = await getAddress();

    const payloadString = JSON.stringify({
      campaignId: payload.campaignId,
      content: payload.content,
      timestamp: payload.timestamp,
    });

     const payloadHash = StellarSdk.hash(Buffer.from(payloadString));
     const { signedTxXdr } = await signTransaction(
       new StellarSdk.TransactionBuilder(
         new StellarSdk.Account(address, "0"),
         {
           fee: StellarSdk.BASE_FEE,
           networkPassphrase: NETWORK_PASSPHRASE,
         }
       )
         .addOperation(
           StellarSdk.Operation.manageData({
             name: "comment_signature",
             value: payloadHash,
           })
         )
         .setTimeout(30)
         .build()
         .toXDR(),
       {
         networkPassphrase: NETWORK_PASSPHRASE,
       }
     );

    const signedTx = StellarSdk.TransactionBuilder.fromXDR(
      signedTxXdr,
      NETWORK_PASSPHRASE
    ) as StellarSdk.Transaction;

    const signatures = signedTx.signatures;
    if (signatures.length === 0) {
      throw new Error("No signature generated");
    }

    return signatures[0].signature().toString("hex");
  } catch (error) {
    throw new Error(`Failed to sign payload: ${parseContractError(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getCampaignComments(campaignId: number): Promise<Comment[]> {
  if (USE_MOCKS) {
    return MOCK_COMMENTS[campaignId] ?? [];
  }

  try {
    const response = await fetch(`/api/campaigns/${campaignId}/comments`);
    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`Failed to fetch comments: ${response.statusText}`);
    }
    const comments = await response.json();
    return comments;
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
  if (USE_MOCKS) {
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

    const response = await fetch(`/api/campaigns/${campaignId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        campaignId,
        content,
        authorAddress,
        timestamp,
        parentId,
        signature,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to create comment: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to create comment: ${parseContractError(error)}`);
  }
}

export async function pinComment(campaignId: number, commentId: string, isPinned: boolean): Promise<Comment> {
  if (USE_MOCKS) {
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
    const response = await fetch(`/api/campaigns/${campaignId}/comments/${commentId}/pin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isPinned }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to pin comment");
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to pin comment: ${parseContractError(error)}`);
  }
}

export async function reportComment(campaignId: number, commentId: string): Promise<Comment> {
  if (USE_MOCKS) {
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
    const response = await fetch(`/api/campaigns/${campaignId}/comments/${commentId}/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to report comment");
    }

    return await response.json();
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

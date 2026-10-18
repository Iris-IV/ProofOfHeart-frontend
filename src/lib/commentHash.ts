import { createHash } from "node:crypto";

/**
 * Canonical hash of an off-chain comment (#1682).
 *
 * The contract's comment censure (`censure_comment` / `is_comment_censured`)
 * keys on an opaque 32-byte hash supplied by the caller. We commit to the same
 * fields the comment signature covers, so a censure applied to a comment in
 * one client hides that comment everywhere.
 *
 * Server-only: uses `node:crypto`.
 */
export interface CommentHashInput {
  campaignId: number;
  content: string;
  authorAddress: string;
  timestamp: number;
}

export function hashComment(input: CommentHashInput): string {
  const canonical = JSON.stringify({
    campaignId: input.campaignId,
    content: input.content,
    authorAddress: input.authorAddress,
    timestamp: input.timestamp,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

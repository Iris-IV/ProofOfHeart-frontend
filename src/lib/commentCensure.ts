import { Comment } from "@/types";
import { isCommentCensured } from "./contractClient";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

/**
 * Drop comments the contract has censured (#1682).
 *
 * Comment text lives off-chain, so moderation is recorded on-chain as a censure
 * against the comment's hash. Filtering here means the UI never renders a
 * censured comment, regardless of which instance served the off-chain API
 * response.
 *
 * A failed lookup fails open — a transient RPC error must not hide every
 * comment on a campaign.
 */
export async function filterCensuredComments(
  campaignId: number,
  comments: Comment[],
): Promise<Comment[]> {
  if (!CONTRACT_ADDRESS) return comments;

  const checks = await Promise.all(
    comments.map(async (comment) => {
      if (!comment.commentHash) return comment;
      try {
        return (await isCommentCensured(campaignId, comment.commentHash)) ? null : comment;
      } catch {
        return comment;
      }
    }),
  );

  return checks.filter((comment): comment is Comment => comment !== null);
}

import { Comment } from "@/types";
import { getKeyValueStore, InMemoryKeyValueStore, type KeyValueStore } from "./persistentStore";

/**
 * Persistence boundary for off-chain campaign comments (#1682).
 *
 * The in-memory store this replaces was process-local: comments vanished on
 * restart and were invisible to other instances. Implementations of this
 * interface back the data with a real store (see `./persistentStore`).
 */
export interface CommentRepository {
  list(campaignId: number): Promise<Comment[]>;
  find(campaignId: number, commentId: string): Promise<Comment | null>;
  add(campaignId: number, comment: Comment): Promise<Comment>;
  update(
    campaignId: number,
    commentId: string,
    patch: Partial<Comment>,
  ): Promise<Comment | null>;
}

function commentsKey(campaignId: number): string {
  return `comments:${campaignId}`;
}

/** Repository over any `KeyValueStore`. */
export class KeyValueCommentRepository implements CommentRepository {
  constructor(private readonly store: KeyValueStore) {}

  async list(campaignId: number): Promise<Comment[]> {
    return (await this.store.get<Comment[]>(commentsKey(campaignId))) ?? [];
  }

  async find(campaignId: number, commentId: string): Promise<Comment | null> {
    const comments = await this.list(campaignId);
    return comments.find((comment) => comment.id === commentId) ?? null;
  }

  async add(campaignId: number, comment: Comment): Promise<Comment> {
    const comments = await this.list(campaignId);
    await this.store.set(commentsKey(campaignId), [...comments, comment]);
    return comment;
  }

  async update(
    campaignId: number,
    commentId: string,
    patch: Partial<Comment>,
  ): Promise<Comment | null> {
    const comments = await this.list(campaignId);
    const index = comments.findIndex((comment) => comment.id === commentId);
    if (index === -1) return null;

    const updated = { ...comments[index], ...patch };
    comments[index] = updated;
    await this.store.set(commentsKey(campaignId), comments);
    return updated;
  }
}

/**
 * In-memory repository: a `KeyValueCommentRepository` backed by an in-memory
 * store. Used when `NODE_ENV=test` keeps the default store process-local.
 */
export class InMemoryCommentRepository extends KeyValueCommentRepository {
  constructor() {
    super(new InMemoryKeyValueStore());
  }
}

let cachedRepository: CommentRepository | null = null;

/** Resolve the process-wide comment repository. */
export function getCommentRepository(): CommentRepository {
  if (!cachedRepository) {
    cachedRepository = new KeyValueCommentRepository(getKeyValueStore());
  }
  return cachedRepository;
}

/** Reset the cached repository so tests can swap the underlying store. */
export function resetCommentRepositoryForTests(): void {
  cachedRepository = null;
}

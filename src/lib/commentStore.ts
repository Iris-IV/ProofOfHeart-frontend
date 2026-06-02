import { Comment } from "@/types";

/**
 * Server-side in-memory comment store.
 * In production, replace with a real database adapter (e.g. Supabase, PlanetScale).
 *
 * Data retention: comments persist for the lifetime of the server process.
 * Reporter privacy: no PII beyond the on-chain wallet address is stored.
 */
export const commentStore = new Map<number, Comment[]>();

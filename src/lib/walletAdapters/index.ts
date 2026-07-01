/**
 * Wallet adapter registry.
 *
 * Import from this file throughout the app:
 *
 *   import { getAdapter, ALL_ADAPTERS } from "@/lib/walletAdapters";
 */

export type { WalletAdapter, WalletId, WalletDescriptor } from "./types";
export { WALLET_DESCRIPTORS } from "./types";

export { FreighterAdapter } from "./FreighterAdapter";
export { LobstrAdapter } from "./LobstrAdapter";
export { XBullAdapter } from "./XBullAdapter";

import type { WalletAdapter, WalletId } from "./types";
import { FreighterAdapter } from "./FreighterAdapter";
import { LobstrAdapter } from "./LobstrAdapter";
import { XBullAdapter } from "./XBullAdapter";

/**
 * All supported adapters in display order.
 * Singletons are fine here because adapters hold no mutable state.
 */
export const ALL_ADAPTERS: readonly WalletAdapter[] = [
  new FreighterAdapter(),
  new LobstrAdapter(),
  new XBullAdapter(),
] as const;

/**
 * Look up a specific adapter by its stable {@link WalletId}.
 *
 * @throws if `id` is not recognised (should never happen in practice).
 */
export function getAdapter(id: WalletId): WalletAdapter {
  const adapter = ALL_ADAPTERS.find((a) => a.id === id);
  if (!adapter) {
    throw new Error(`No wallet adapter registered for id "${id}"`);
  }
  return adapter;
}

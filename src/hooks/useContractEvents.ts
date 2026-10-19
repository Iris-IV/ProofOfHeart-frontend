import { useEffect, useRef } from "react";
import { eventSubscriber, EventHandler } from "../lib/eventSubscriber";

/**
 * Hook to subscribe to a specific Soroban contract event topic.
 *
 * **Memory leak prevention:**
 * - Automatically starts RPC polling when first component mounts
 * - Automatically stops polling when last component unmounts
 * - Cancels in-flight RPC requests on cleanup
 * - Clears all timers on unmount
 *
 * The underlying eventSubscriber handles:
 * - Cursor persistence across reloads (localStorage)
 * - Exponential backoff with jitter on failures
 * - Reference counting for active subscriptions
 * - AbortController for cancelling pending requests
 *
 * @param topic The exact topic string to subscribe to.
 * @param handler The callback to fire when an event with this topic is received.
 *
 * @example
 * ```tsx
 * useContractEvents("campaign_created", (event) => {
 *   console.log("New campaign:", event);
 * });
 * ```
 */
export function useContractEvents(topic: string, handler: EventHandler) {
  // Use ref to maintain stable handler reference across re-renders
  const handlerRef = useRef<EventHandler>(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    // Stable wrapper that calls the latest handler
    const stableHandler: EventHandler = (event) => {
      handlerRef.current(event);
    };

    // Ensure the global event subscriber is polling
    eventSubscriber.start();

    // Register the component's handler
    eventSubscriber.on(topic, stableHandler);

    return () => {
      // Unregister on unmount
      // This will call stop() automatically if it's the last subscriber
      eventSubscriber.off(topic, stableHandler);
    };
  }, [topic]);
}

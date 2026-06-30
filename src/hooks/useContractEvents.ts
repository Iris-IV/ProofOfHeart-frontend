import { useEffect } from "react";
import { eventSubscriber, EventHandler } from "../lib/eventSubscriber";

/**
 * Hook to subscribe to a specific Soroban contract event topic.
 * The underlying eventSubscriber handles cursor persistence and backoff automatically.
 *
 * @param topic The exact topic string to subscribe to.
 * @param handler The callback to fire when an event with this topic is received.
 */
export function useContractEvents(topic: string, handler: EventHandler) {
  useEffect(() => {
    // Ensure the global event subscriber is polling
    eventSubscriber.start();

    // Register the component's handler
    eventSubscriber.on(topic, handler);

    return () => {
      // Unregister on unmount
      eventSubscriber.off(topic, handler);
    };
  }, [topic, handler]);
}

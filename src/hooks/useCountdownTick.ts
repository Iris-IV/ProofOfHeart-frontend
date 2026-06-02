// Single shared 60-second timer for all DeadlineCountdown instances.
// Prevents N×setInterval when many countdown cards are mounted simultaneously.

type Unsubscribe = () => void;

const subscribers = new Set<() => void>();
let timerId: ReturnType<typeof setInterval> | null = null;

function tick() {
  subscribers.forEach((cb) => cb());
}

export function subscribeToCountdownTick(callback: () => void): Unsubscribe {
  subscribers.add(callback);
  if (timerId === null) {
    timerId = setInterval(tick, 60_000);
  }
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  };
}

import * as StellarSdk from "@stellar/stellar-sdk";

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://soroban-testnet.stellar.org";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

export type EventHandler = (event: StellarSdk.rpc.Api.EventResponse) => void;

type PollRequestArgs = StellarSdk.rpc.Api.GetEventsRequest;

class EventSubscriber {
  private server: StellarSdk.rpc.Server;
  private cursor: string | undefined;
  private isPolling = false;
  private handlers = new Map<string, EventHandler[]>();
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;
  private backoffMs = 2000;
  private maxBackoffMs = 60000;
  private consecutiveFailures = 0;
  private lastSuccessTime = 0;
  private minBackoffMs = 1000;
  private activeSubscriptions = 0;

  constructor() {
    this.server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
  }

  public on(topic: string, handler: EventHandler) {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    this.handlers.get(topic)!.push(handler);
    this.activeSubscriptions++;
  }

  public off(topic: string, handler: EventHandler) {
    const topicHandlers = this.handlers.get(topic);
    if (topicHandlers) {
      const filtered = topicHandlers.filter((h) => h !== handler);
      this.handlers.set(topic, filtered);
      this.activeSubscriptions--;

      // Stop polling when no handlers remain
      if (this.activeSubscriptions <= 0) {
        this.activeSubscriptions = 0;
        this.stop();
      }
    }
  }

  public start() {
    if (this.isPolling) return;
    this.isPolling = true;

    // Attempt to load the cursor from local storage for persistence across reloads
    try {
      const savedCursor = localStorage.getItem(`soroban_cursor_${CONTRACT_ADDRESS}`);
      if (savedCursor) {
        this.cursor = savedCursor;
      }
    } catch (e) {
      // Ignore local storage errors
    }

    this.poll();
  }

  public stop() {
    this.isPolling = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    // Cancel in-flight RPC request
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async poll() {
    if (!this.isPolling || !CONTRACT_ADDRESS) return;

    // Create new AbortController for this poll cycle
    this.abortController = new AbortController();

    try {
      const baseArgs = {
        limit: 100,
        filters: [
          {
            type: "contract" as const,
            contractIds: [CONTRACT_ADDRESS],
          },
        ],
      };

      let requestArgs: PollRequestArgs;

      if (this.cursor) {
        requestArgs = { ...baseArgs, cursor: this.cursor };
      } else {
        // Fallback to getting latest ledger if no cursor
        try {
          const latestLedger = await this.server.getLatestLedger();
          requestArgs = { ...baseArgs, startLedger: latestLedger.sequence };
        } catch (e) {
          // If latest ledger fails, schedule retry instead of silently dropping
          if (this.isPolling) {
            this.timeoutId = setTimeout(() => this.poll(), this.backoffMs);
          }
          return;
        }
      }

      const response = await this.server.getEvents(requestArgs);

      if (response.events && response.events.length > 0) {
        for (const event of response.events) {
          if (event.type !== "contract") continue;

          // Map each topic to handlers
          // The topics array contains xdr.ScVal, we extract the first string for matching
          if (event.topic && event.topic.length > 0) {
            try {
              // Soroban sdk wraps topic as ScVal.
              const topicStr = event.topic[0].value()?.toString() || "";

              const handlers = this.handlers.get(topicStr);
              if (handlers) {
                handlers.forEach((h) => {
                  try {
                    h(event);
                  } catch (e) {
                    console.error("Event handler error:", e);
                  }
                });
              }
            } catch (e) {
              console.warn("Could not decode event topic", e);
            }
          }

          this.cursor = (event as StellarSdk.rpc.Api.EventResponse & { pagingToken?: string })
            .pagingToken || event.id;
          try {
            if (this.cursor) {
              localStorage.setItem(`soroban_cursor_${CONTRACT_ADDRESS}`, this.cursor);
            }
          } catch (e) {
            // Ignore
          }
        }
      }

      // Reset backoff on success
      this.backoffMs = 2000;
      this.consecutiveFailures = 0;
      this.lastSuccessTime = Date.now();
    } catch (error) {
      // Don't log errors for aborted requests (intentional cleanup)
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      console.warn("Soroban event polling error:", error);
      this.consecutiveFailures++;

      // Exponential backoff with jitter to avoid thundering herd (#1504)
      const exponentialBackoff = Math.min(
        this.minBackoffMs * Math.pow(1.5, this.consecutiveFailures),
        this.maxBackoffMs,
      );
      const jitter = Math.random() * (exponentialBackoff * 0.25);
      this.backoffMs = exponentialBackoff + jitter;
    } finally {
      // Clear the abort controller after request completes
      this.abortController = null;
    }

    if (this.isPolling) {
      this.timeoutId = setTimeout(() => this.poll(), this.backoffMs);
    }
  }
}

export const eventSubscriber = new EventSubscriber();

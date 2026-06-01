import * as StellarSdk from "@stellar/stellar-sdk";

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://soroban-testnet.stellar.org";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";

export type EventHandler = (event: StellarSdk.rpc.Api.EventResponse) => void;

class EventSubscriber {
  private server: StellarSdk.rpc.Server;
  private cursor: string | undefined;
  private isPolling = false;
  private handlers = new Map<string, EventHandler[]>();
  private timeoutId: NodeJS.Timeout | null = null;
  private backoffMs = 2000;
  private maxBackoffMs = 60000;

  constructor() {
    this.server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
  }

  public on(topic: string, handler: EventHandler) {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    this.handlers.get(topic)!.push(handler);
  }

  public off(topic: string, handler: EventHandler) {
    const topicHandlers = this.handlers.get(topic);
    if (topicHandlers) {
      this.handlers.set(topic, topicHandlers.filter(h => h !== handler));
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
  }

  private async poll() {
    if (!this.isPolling || !CONTRACT_ADDRESS) return;

    try {
      const requestArgs: any = {
        limit: 100,
        filters: [
          {
            type: "contract",
            contractIds: [CONTRACT_ADDRESS]
          }
        ]
      };

      if (this.cursor) {
        requestArgs.pagination = { cursor: this.cursor };
      } else {
        // Fallback to getting latest ledger if no cursor
        try {
          const latestLedger = await this.server.getLatestLedger();
          requestArgs.startLedger = latestLedger.sequence;
        } catch (e) {
          // If latest ledger fails, just don't pass startLedger and wait for next tick
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
                handlers.forEach(h => {
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
          
          this.cursor = (event as any).pagingToken || event.id;
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
    } catch (error) {
      console.warn("Soroban event polling error:", error);
      // Exponential backoff
      this.backoffMs = Math.min(this.backoffMs * 1.5, this.maxBackoffMs);
    }

    if (this.isPolling) {
      this.timeoutId = setTimeout(() => this.poll(), this.backoffMs);
    }
  }
}

export const eventSubscriber = new EventSubscriber();

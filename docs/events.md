# Soroban Events

This guide covers the on-chain events the ProofOfHeart contract emits, how the frontend decodes them, and how the browser keeps its views in sync. It also explains what is _not_ in this repository, such as a socket server or an indexer webhook for chain events.

## Contents

- [How events reach the browser](#how-events-reach-the-browser)
- [Event reference](#event-reference)
- [Decoding events](#decoding-events)
- [Subscribing to a campaign](#subscribing-to-a-campaign)
- [Generic contract subscriber](#generic-contract-subscriber)
- [Configuration](#configuration)
- [Limits and failure modes](#limits-and-failure-modes)
- [Application observability events](#application-observability-events)

## How events reach the browser

There is no WebSocket or push channel. The frontend polls Soroban RPC with `getEvents`, filtered to the campaign contract, and tracks progress with a cursor:

```
Soroban RPC  <--getEvents(filters, cursor)--  browser (polling loop)
     |                                              |
     +--- events[] + cursor ----------------------->+--> decodeContractEvent / handlers
```

Two polling paths exist:

| Path                                                                | Used for                                    | Module                       |
| ------------------------------------------------------------------- | ------------------------------------------- | ---------------------------- |
| Per-campaign subscription (`subscribeContributionMadeEvents`)       | Live contribution feed on one campaign      | `src/lib/sorobanEvents.ts`   |
| Shared contract subscriber (`eventSubscriber`, `useContractEvents`) | Topic-keyed handlers for the whole contract | `src/lib/eventSubscriber.ts` |

Both return data only when event streaming is available. See [Configuration](#configuration).

## Event reference

The client understands two contract events. Each is identified by its name in `topic[0]` and the campaign ID in `topic[1]`.

### `contribution_made`

| Part       | Value                                                                  |
| ---------- | ---------------------------------------------------------------------- |
| `topic[0]` | Symbol `contribution_made`                                             |
| `topic[1]` | `u32` campaign ID                                                      |
| `topic[2]` | Contributor address (decoded with `scValToNative`)                     |
| `value`    | Contribution amount. Decoded to `bigint` by `parseContributionAmount`. |

Decoded shape (`DecodedContributionMadeEvent`):

```ts
{
  type: "contribution_made";
  campaignId: number;
  contributor: string;
  amount: bigint;
}
```

### `campaign_vote_cast`

| Part       | Value                                                       |
| ---------- | ----------------------------------------------------------- |
| `topic[0]` | Symbol `campaign_vote_cast`                                 |
| `topic[1]` | `u32` campaign ID                                           |
| `topic[2]` | Voter address                                               |
| `value`    | Boolean. `true` approves the milestone, `false` rejects it. |

Decoded shape (`DecodedVoteCastEvent`):

```ts
{
  type: "campaign_vote_cast";
  campaignId: number;
  voter: string;
  approve: boolean;
}
```

Any other event, or one with fewer than two topics, decodes to `null`. Callers can skip foreign events without a `try`/`catch`.

## Decoding events

Use `decodeContractEvent` to turn a raw RPC event into a typed object:

```ts
import { decodeContractEvent } from "@/lib/sorobanEvents";

const decoded = decodeContractEvent(rawEvent);
if (decoded?.type === "contribution_made") {
  console.log(decoded.campaignId, decoded.contributor, decoded.amount);
}
```

Topic filters for a single campaign are built with `contributionMadeTopicFilter(campaignId)` and `voteCastTopicFilter(campaignId)`. They match the symbol and campaign ID exactly and accept any value for the address topic.

## Subscribing to a campaign

`subscribeContributionMadeEvents` polls for new contributions on one campaign. It chains `getEvents` calls with the returned cursor rather than running a fixed `setInterval`:

```ts
import { subscribeContributionMadeEvents } from "@/lib/sorobanEvents";

const subscription = subscribeContributionMadeEvents({
  campaignId: 42,
  onEvents: ({ events, latestLedger }) => {
    // `events` are already filtered to this campaign's contribution_made events.
  },
  onError: (error) => {
    // Polling backs off and retries; this is informational.
  },
  idleIntervalMs: 2000, // optional
});

// Returns null when streaming is unavailable (mocks on, or no contract address).
subscription?.unsubscribe();
```

Behaviour:

- With no new events, the next poll runs after `idleIntervalMs` (default 2000 ms, or `NEXT_PUBLIC_CONTRIBUTION_EVENTS_POLL_MS`).
- When a poll returns a full batch of 100 events, the next poll runs immediately to catch up.
- After an error, the delay grows by 1.5× per consecutive failure, capped at 60 s, and resets after a successful poll.
- The first poll has no cursor. It starts from `latestLedger - 1`, so it reads the most recent ledger's events.
- `fetchContributionMadeEvents` performs a single page fetch with the same filter, for one-off reads.
- `fetchVoteCastEvents` does the same for `campaign_vote_cast`.

## Generic contract subscriber

`eventSubscriber` is a module-level singleton that polls every event from the contract. Handlers are registered by topic string:

```ts
import { eventSubscriber } from "@/lib/eventSubscriber";

const handler = (event) => {
  // event: StellarSdk.rpc.Api.EventResponse
};

eventSubscriber.on("contribution_made", handler);
eventSubscriber.start();

// Later
eventSubscriber.off("contribution_made", handler);
```

`useContractEvents(topic, handler)` wraps this for React components. It starts the subscriber on mount, registers the handler, and removes it on unmount.

Details:

- The subscriber stops when its last handler is removed.
- It requests up to 100 events per poll.
- The cursor is saved to `localStorage` under `soroban_cursor_<CONTRACT_ADDRESS>`, so reloads resume where the last session stopped. Storage errors are ignored.
- The first run with no saved cursor starts at the latest ledger. Events emitted before that are not delivered.

Prefer `subscribeContributionMadeEvents` for a single campaign's feed. Use `eventSubscriber` when a component needs several topics across the contract.

## Configuration

| Variable                                  | Purpose                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_USE_MOCKS`                   | When `"true"`, event streaming is disabled and the helpers return `null`.                           |
| `NEXT_PUBLIC_CONTRACT_ADDRESS`            | Contract to filter on. `NEXT_PUBLIC_CONTRACT_ID` is accepted as a fallback. Required for streaming. |
| `NEXT_PUBLIC_SOROBAN_RPC_URL`             | Soroban RPC endpoint. Falls back to `NEXT_PUBLIC_RPC_URL`, then to the public testnet RPC.          |
| `NEXT_PUBLIC_CONTRIBUTION_EVENTS_POLL_MS` | Idle delay between contribution polls, in milliseconds.                                             |

Streaming is available only when mocks are off and a contract address is set. `isEventStreamingAvailable()` reports this.

## Limits and failure modes

- **Retention.** RPC nodes keep events for a limited window of ledgers. Requests with a `startLedger` or cursor older than that window fail or return nothing. A subscriber that has been offline for too long may miss events.
- **Polling latency.** New events appear after the next poll, so expect delay of up to the idle interval plus RPC latency.
- **No delivery guarantee across tabs.** Each tab polls on its own. Cursors saved by `eventSubscriber` are per browser, not per user.
- **Foreign events.** Events from other contracts are excluded by the contract filter. Malformed events decode to `null`.

## Application observability events

Not every event in this system comes from the chain. The app also sends its own telemetry, such as failed simulations and RPC timeouts. These are not Soroban events and are not decoded by the functions above.

The server forwards those events to `OBSERVABILITY_WEBHOOK_URL` when it is set. That is the only outbound webhook in the repository. There is no webhook that receives on-chain `contribution_made` or `campaign_vote_cast` events. To build one, an indexer or relayer would need to subscribe to RPC and forward events itself. See [Observability](./observability.md) for the telemetry pipeline.

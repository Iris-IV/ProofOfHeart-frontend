# Observability Module

The observability module (`src/lib/observability/`) provides internal telemetry for monitoring contract interactions, transaction flows, and RPC operations. It captures structured events, computes failure rates, and triggers alerts when thresholds are exceeded.

## Architecture

The module consists of four core files plus API routes:

### Core Files

- **`types.ts`** - Type definitions for events, categories, kinds, metrics snapshots, and alerts
- **`classify.ts`** - Error classification logic that converts raw errors into structured `ClassifiedFailure` objects
- **`record.ts`** - Event construction, logging, and transmission to backend/webhook
- **`metricsStore.ts`** - In-memory event storage, rate computation, and alert evaluation
- **`index.ts`** - Public API exports

### API Routes

- **`/api/observability/events`** (POST) - Ingests observability events from the client
- **`/api/observability/metrics`** (GET) - Returns a metrics snapshot with counters, rates, alerts, and recent events

## Data Flow

```
App Error/Success
    ↓
classify.ts (classifySimulationFailure / classifyRpcFailure)
    ↓
ClassifiedFailure { category, kind, contractErrorCode?, message }
    ↓
record.ts (recordObservabilityEvent / recordContractError)
    ↓
metricsStore.ts (recordEvent)
    ↓
In-memory Ring Buffer (MAX_EVENTS = 2000) & Alert Evaluation
```

## Event Categories & Kinds

Events are grouped into three categories:

| Category   | Kind                    | Description                                     |
| ---------- | ----------------------- | ----------------------------------------------- |
| `rpc`      | `rpc_failure`           | RPC node connectivity, network, or server error |
| `contract` | `simulation_failure`    | Soroban simulation returned non-zero error code |
| `contract` | `user_declined`         | User rejected transaction in wallet extension   |
| `contract` | `tx_submission_failure` | Horizon/RPC transaction submission failed       |
| `app`      | `client_render_error`   | React ErrorBoundary caught render error         |
| `app`      | `api_route_failure`     | Internal Next.js API route returned 50x         |

## Alert Thresholds & Metrics

The `metricsStore` evaluates three windowed failure rates over the stored event buffer:

- **Simulation Failure Rate**: `simulation_failure / total_events` (default threshold: 15%)
- **User Decline Rate**: `user_declined / total_events` (default threshold: 10%)
- **RPC Failure Rate**: `rpc_failure / total_events` (default threshold: 20%)

### Threshold Environment Variables

Alert thresholds can be configured via environment variables:

| Environment Variable                 | Default | Description                        |
| ------------------------------------ | ------- | ---------------------------------- |
| `OBSERVABILITY_SIMULATION_THRESHOLD` | `0.15`  | Simulation failure alert threshold |
| `OBSERVABILITY_DECLINE_THRESHOLD`    | `0.10`  | User decline alert threshold       |
| `OBSERVABILITY_RPC_THRESHOLD`        | `0.20`  | RPC failure alert threshold        |

### Alert Levels

Alerts require a minimum sample size of **10 events** before evaluation:

- **WARNING**: Failure rate reaches 1.0x - 1.99x threshold
- **CRITICAL**: Failure rate reaches 2.0x+ threshold

## Adding a New Observability Event

To instrument a new failure path or event:

1. **Add the event kind** to `ObservabilityEventKind` in `types.ts`:

```typescript
export type ObservabilityEventKind =
  | "rpc_failure"
  | "simulation_failure"
  // ... existing kinds
  | "your_new_event_kind";
```

2. **Add classification logic** in `classify.ts` if parsing error objects/codes:

```typescript
export function classifyYourError(error: unknown): ClassifiedFailure {
  // Return category, kind, message, and optional contractErrorCode
}
```

3. **Call the recording helper** at the invocation site:

```typescript
import { recordObservabilityEvent } from "@/lib/observability";

recordObservabilityEvent({
  category: "contract",
  kind: "your_new_event_kind",
  message: "Description of the failure",
  metadata: { customField: "value" },
});
```

## Admin Observability Dashboard

Platform administrators can view real-time metrics and event logs at:

```
/admin/observability
```

The dashboard displays overall health status (Healthy / Warning / Critical), active alerts, breakdown by category, and a searchable ring-buffer log of recent events.

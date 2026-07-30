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
record.ts (buildObservabilityEvent / buildSuccessEvent)
    ↓
ObservabilityEvent { id, timestamp, category, kind, operation, ... }
    ↓
record.ts (recordObservabilityEvent)
    ├→ console.log (dev only)
    ├→ POST /api/observability/events
    └→ POST webhook (optional, via NEXT_PUBLIC_OBSERVABILITY_WEBHOOK_URL)
    ↓
metricsStore.ts (ingestObservabilityEvent)
    ↓
In-memory store (max 2000 events, FIFO eviction)
    ↓
GET /api/observability/metrics
    ↓
ObservabilityMetricsSnapshot { counters, rates, alerts, recentEvents }
```

## Event Categories and Kinds

### Categories

- **`contract`** - Soroban contract errors
- **`transaction`** - Transaction lifecycle events (simulation, submission, confirmation)
- **`rpc`** - RPC operation errors and timeouts

### Kinds

- **`contract_error`** - Contract execution error with `contractErrorCode` and `contractErrorKey`
- **`simulation_failure`** - Transaction simulation failed (non-contract error)
- **`submission_failure`** - Transaction submission to network failed
- **`confirmation_timeout`** - Transaction confirmation timed out
- **`confirmation_failed`** - Transaction confirmation failed
- **`rpc_error`** - Generic RPC error
- **`rpc_timeout`** - RPC operation timed out
- **`transaction_success`** - Transaction completed successfully

## Metrics and Alerts

### Counters

The module tracks:

- Total events
- Events by kind
- Events by contract error code
- Events by operation name

### Rates

Computed over a sliding time window (default 5 minutes):

- `simulationFailureRate` - simulation failures / transaction attempts
- `submissionFailureRate` - submission failures / transaction attempts
- `rpcTimeoutRate` - RPC timeouts / RPC operations
- `contractErrorRate` - contract errors / transaction attempts

### Alerts

Alerts trigger when rates exceed configurable thresholds (environment variables):

- `OBSERVABILITY_ALERT_SIMULATION_FAILURE_RATE` (default: 0.15)
- `OBSERVABILITY_ALERT_SUBMISSION_FAILURE_RATE` (default: 0.1)
- `OBSERVABILITY_ALERT_RPC_TIMEOUT_RATE` (default: 0.2)

Alert severity is `warning` at threshold and `critical` at 2× threshold. Minimum sample size of 10 events is required before alerting.

## Adding a New Event Type

To add a new observability event type, follow these steps:

### 1. Add the Kind to `types.ts`

```typescript
// src/lib/observability/types.ts
export type ObservabilityKind =
  | "contract_error"
  | "simulation_failure"
  // ... existing kinds
  | "your_new_kind"; // Add here
```

### 2. Add Classification Logic (if needed)

If your new kind requires error classification, add a classifier in `classify.ts`:

```typescript
// src/lib/observability/classify.ts
export function classifyYourError(error: unknown, operation?: string): ClassifiedFailure {
  // Your classification logic here
  return {
    category: "transaction", // or "contract" or "rpc"
    kind: "your_new_kind",
    message: error instanceof Error ? error.message : String(error),
  };
}
```

Export the new classifier in `index.ts`:

```typescript
// src/lib/observability/index.ts
export { classifyYourError } from "./classify";
```

### 3. Add Recording Helper (optional)

For convenience, add a recording helper in `record.ts`:

```typescript
// src/lib/observability/record.ts
export function recordYourNewKind(
  message: string,
  options?: { operation?: string; rpcStatus?: string; txHash?: string },
): void {
  recordObservabilityKind("your_new_kind", message, options);
}
```

Export it in `index.ts`:

```typescript
// src/lib/observability/index.ts
export {
  // ... existing exports
  recordYourNewKind,
} from "./record";
```

### 4. Update Metrics Computation (if needed)

If your new kind should be included in rate calculations, update `metricsStore.ts`:

```typescript
// src/lib/observability/metricsStore.ts
function computeRates(
  windowEvents: ObservabilityEvent[],
  windowMs: number,
): ObservabilityRatesSnapshot {
  // Add your new kind to the relevant denominator or numerator
  const yourNewKindCount = windowEvents.filter((event) => event.kind === "your_new_kind").length;

  // Update the returned snapshot if you want a new rate field
  return {
    // ... existing rates
    // yourNewRate: yourNewKindCount / denom,
  };
}
```

### 5. Add Alert Threshold (if needed)

If your new kind should trigger alerts, add threshold configuration and alert logic in `metricsStore.ts`:

```typescript
// src/lib/observability/metricsStore.ts
export function evaluateAlerts(rates: ObservabilityRatesSnapshot): ObservabilityAlert[] {
  const yourThreshold = Number(process.env.OBSERVABILITY_ALERT_YOUR_RATE) || 0.1;

  if (rates.sampleSize >= 10 && rates.yourNewRate >= yourThreshold) {
    alerts.push({
      id: "elevated-your-kind",
      severity: rates.yourNewRate >= yourThreshold * 2 ? "critical" : "warning",
      message: "Your kind rate is above the configured threshold.",
      metric: "yourNewRate",
      currentRate: rates.yourNewRate,
      threshold: yourThreshold,
      triggeredAt: now,
    });
  }

  return alerts;
}
```

### 6. Use the New Event Type

Record events from your application code:

```typescript
import { recordYourNewKind, classifyYourError } from "@/lib/observability";

// Using the classifier (if you added one)
try {
  await someOperation();
} catch (error) {
  const failure = classifyYourError(error, "someOperation");
  recordObservabilityFailure(failure, { operation: "someOperation" });
}

// Or using the helper (if you added one)
recordYourNewKind("Something happened", { operation: "someOperation" });

// Or using the generic kind recorder
recordObservabilityKind("your_new_kind", "Something happened", {
  operation: "someOperation",
});
```

## Environment Variables

- `NEXT_PUBLIC_STELLAR_NETWORK` - Network name (mainnet/testnet), auto-detected from `NEXT_PUBLIC_NETWORK_PASSPHRASE` if not set
- `NEXT_PUBLIC_OBSERVABILITY_WEBHOOK_URL` - Optional external webhook URL for event forwarding
- `OBSERVABILITY_ALERT_SIMULATION_FAILURE_RATE` - Alert threshold for simulation failures (default: 0.15)
- `OBSERVABILITY_ALERT_SUBMISSION_FAILURE_RATE` - Alert threshold for submission failures (default: 0.1)
- `OBSERVABILITY_ALERT_RPC_TIMEOUT_RATE` - Alert threshold for RPC timeouts (default: 0.2)

## Testing

The module exports `resetObservabilityMetricsForTests()` for clearing the in-memory store between tests:

```typescript
import { resetObservabilityMetricsForTests } from "@/lib/observability";

beforeEach(() => {
  resetObservabilityMetricsForTests();
});
```

## Storage

Events are stored in-memory on the server with a maximum of 2,000 events (FIFO eviction). This is suitable for development and monitoring but not for long-term analytics. For production persistence, integrate an external error tracker (see issue #381).

## API Endpoints

### POST /api/observability/events

Ingests an observability event. Accepts JSON matching `ObservabilityEvent` schema. Returns 202 on success.

### GET /api/observability/metrics?windowMs=300000

Returns a metrics snapshot. Optional `windowMs` query parameter controls the time window for rate calculations (default: 5 minutes).

# Observability Module

The observability module (`src/lib/observability/`) records structured telemetry for contract calls, transaction submission, and RPC requests. It keeps a rolling in-memory event buffer, computes failure rates over a time window, and raises alerts when a rate crosses its threshold.

## Architecture

### Core files

| File              | Responsibility                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `types.ts`        | Event, kind, category, snapshot, and alert types. The source of truth for metric and kind names.  |
| `classify.ts`     | Converts thrown errors into a `ClassifiedFailure` (category, kind, optional contract error code). |
| `record.ts`       | Builds events, logs them in development, and posts them to `/api/observability/events`.           |
| `metricsStore.ts` | Holds the event buffer, computes rates for a window, and evaluates alert thresholds.              |
| `index.ts`        | Public exports.                                                                                   |

### API routes

| Route                        | Method | Auth                     | Purpose                                                                                            |
| ---------------------------- | ------ | ------------------------ | -------------------------------------------------------------------------------------------------- |
| `/api/observability/events`  | POST   | `x-metrics-token` header | Ingests one event. Forwards it to `OBSERVABILITY_WEBHOOK_URL` if set.                              |
| `/api/observability/metrics` | GET    | `x-metrics-token` header | Returns a snapshot: counters, rates, alerts, recent events. Accepts `?windowMs=` (default 300000). |

Both routes return `503` when `METRICS_SECRET_TOKEN` is unset and `401` when the header is missing or wrong. The events route is also rate-limited to 10 requests per minute per client.

## Data flow

```
Contract call / RPC request
    ↓
classify.ts  (classifySimulationFailure, classifyRpcFailure)
    ↓
ClassifiedFailure { category, kind, contractErrorCode?, contractErrorKey?, message }
    ↓
record.ts    (recordObservabilityFailure / recordObservabilityKind / recordObservabilitySuccess)
    ↓
    ├── console.info("[observability]", …)   development builds only
    └── POST /api/observability/events       browser only (see Known gaps)
    ↓
metricsStore.ts  ingestObservabilityEvent
    ↓
In-memory buffer: at most 1000 events, 1 hour retention
    ↓
getObservabilityMetricsSnapshot(windowMs) → rates + alerts
```

## Categories and kinds

Every event has a `category` and a `kind`. The kinds below are the complete `ObservabilityKind` union in `types.ts`.

| Kind                   | Category      | Emitted when                                              |
| ---------------------- | ------------- | --------------------------------------------------------- |
| `contract_error`       | `contract`    | An error carries a known contract error code.             |
| `simulation_failure`   | `transaction` | Simulation failed without a contract error code.          |
| `submission_failure`   | `transaction` | `sendTransaction` failed or returned an error status.     |
| `confirmation_timeout` | `transaction` | The transaction was not confirmed before polling gave up. |
| `confirmation_failed`  | `transaction` | The transaction was included on-chain but failed.         |
| `rpc_error`            | `rpc`         | An RPC request failed for a reason other than a timeout.  |
| `rpc_timeout`          | `rpc`         | An RPC request timed out or was aborted.                  |
| `transaction_success`  | `transaction` | A transaction was confirmed successfully.                 |

`contractErrorCode` and `contractErrorKey` are set on `contract_error` events. `operation` names the contract method or RPC call, and `txHash` is set when one exists.

## Metrics

`getObservabilityMetricsSnapshot(windowMs)` returns `rates` computed over events in the window:

| Rate                    | Formula                         |
| ----------------------- | ------------------------------- |
| `simulationFailureRate` | `simulation_failure / attempts` |
| `submissionFailureRate` | `submission_failure / attempts` |
| `contractErrorRate`     | `contract_error / attempts`     |
| `rpcTimeoutRate`        | `rpc_timeout / rpc samples`     |

Where:

- `attempts` counts `transaction_success`, `simulation_failure`, `submission_failure`, `confirmation_timeout`, and `confirmation_failed`. A minimum of 1 is used to avoid dividing by zero.
- `rpc samples` counts events whose category is `rpc` or whose kind starts with `rpc`.
- `sampleSize` is the number of events in the window, regardless of kind.

Each snapshot also has `counters` (`total`, `byKind`, `byContractErrorCode`, `byOperation`), `alerts`, and `recentEvents`.

## Alert thresholds

Three rates are checked for alerts. `contractErrorRate` is reported in the snapshot but does not raise an alert.

| Alert metric            | Environment variable                          | Default |
| ----------------------- | --------------------------------------------- | ------- |
| `simulationFailureRate` | `OBSERVABILITY_ALERT_SIMULATION_FAILURE_RATE` | `0.15`  |
| `submissionFailureRate` | `OBSERVABILITY_ALERT_SUBMISSION_FAILURE_RATE` | `0.10`  |
| `rpcTimeoutRate`        | `OBSERVABILITY_ALERT_RPC_TIMEOUT_RATE`        | `0.20`  |

A value that is missing, zero, or not a number falls back to the default.

### Alert levels

Alerts are only evaluated when the window holds at least **10 events**.

- **warning**: the rate is at or above the threshold.
- **critical**: the rate is at or above twice the threshold.

## Adding a new observability event

1. **Add the kind** to `ObservabilityKind` in `src/lib/observability/types.ts`, and set its category in the `category` union if needed.

2. **Classify the error** in `classify.ts` if the new path needs parsing. Return a `ClassifiedFailure`:

```typescript
export function classifyYourError(error: unknown): ClassifiedFailure {
  return {
    category: "rpc",
    kind: "rpc_error",
    message: error instanceof Error ? error.message : String(error),
  };
}
```

3. **Record it** at the call site. Use `recordObservabilityKind` for a kind with a fixed message, or `recordObservabilityFailure` for a classified error:

```typescript
import { recordObservabilityKind } from "@/lib/observability";

recordObservabilityKind("submission_failure", "Transaction submission failed.", {
  operation: "contribute",
});
```

`recordObservabilityEvent` takes a full `ObservabilityEvent`. Its fields are listed in `types.ts`. There is no free-form `metadata` field.

4. **Add a test** in `src/__tests__/lib/observability.test.ts`.

If the new kind should affect alerting, also update `computeRates` and `evaluateAlerts` in `metricsStore.ts`.

## Admin observability dashboard

Platform administrators can view metrics and recent events at:

```
/admin/observability
```

The dashboard shows overall health (Healthy / Warning / Critical), active alerts, a breakdown by category, and a searchable log of recent events. It reads `/api/observability/metrics` (see Known gaps).

## Known gaps

- **Browser requests are not authenticated.** `record.ts` posts events to `/api/observability/events`, and `ObservabilityDashboard` reads `/api/observability/metrics`. Neither sends `x-metrics-token`, and the token must not be exposed to the browser. Both routes therefore reject these requests with `401` unless a proxy adds the header. Server-side callers can send the token.
- **State is per process.** The buffer lives in memory. It is lost on restart, and each server instance has its own buffer.

## Configuration

| Variable                                      | Purpose                                                             |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `METRICS_SECRET_TOKEN`                        | Required by both observability routes. Unset disables them (`503`). |
| `OBSERVABILITY_WEBHOOK_URL`                   | Server-side webhook that receives each ingested event as JSON.      |
| `OBSERVABILITY_ALERT_SIMULATION_FAILURE_RATE` | Simulation failure alert threshold (default `0.15`).                |
| `OBSERVABILITY_ALERT_SUBMISSION_FAILURE_RATE` | Submission failure alert threshold (default `0.10`).                |
| `OBSERVABILITY_ALERT_RPC_TIMEOUT_RATE`        | RPC timeout alert threshold (default `0.20`).                       |

See `docs/ENVIRONMENT_VARIABLES.md` for the full list.

import {
  getObservabilityMetricsSnapshot,
  ingestObservabilityEvent,
  purgeStaleEvents,
  resetObservabilityMetricsForTests,
} from "@/lib/observability/metricsStore";
import { classifySimulationFailure } from "@/lib/observability/classify";
import { buildObservabilityEvent } from "@/lib/observability/record";
import type { ObservabilityEvent } from "@/lib/observability/types";
import { ContractError } from "@/utils/contractErrors";

describe("observability", () => {
  beforeEach(() => {
    resetObservabilityMetricsForTests();
  });

  it("classifies Soroban contract errors with codes", () => {
    const failure = classifySimulationFailure(
      new Error("Error(Contract, #16)"),
      "vote_on_campaign",
    );
    expect(failure.kind).toBe("contract_error");
    expect(failure.contractErrorCode).toBe(ContractError.AlreadyVoted);
  });

  it("aggregates events and evaluates alert thresholds", () => {
    const now = new Date().toISOString();
    for (let i = 0; i < 8; i++) {
      ingestObservabilityEvent(
        buildObservabilityEvent(
          { category: "transaction", kind: "simulation_failure", message: "sim failed" },
          { operation: "contribute" },
        ),
      );
    }
    for (let i = 0; i < 2; i++) {
      ingestObservabilityEvent({
        id: `ok-${i}`,
        timestamp: now,
        category: "transaction",
        kind: "transaction_success",
        operation: "contribute",
        network: "testnet",
      });
    }

    const snapshot = getObservabilityMetricsSnapshot(5 * 60_000);
    expect(snapshot.counters.byKind.simulation_failure).toBe(8);
    expect(snapshot.alerts.some((alert) => alert.id === "elevated-simulation-failures")).toBe(true);
  });
});

describe("purgeStaleEvents", () => {
  const HOUR_MS = 60 * 60 * 1_000;
  const MIN_MS = 60 * 1_000;
  const T0 = new Date("2026-07-30T12:00:00.000Z").getTime();

  function makeEvent(id: string, timestamp: number): ObservabilityEvent {
    return {
      id,
      timestamp: new Date(timestamp).toISOString(),
      category: "transaction",
      kind: "transaction_success",
      network: "testnet",
    };
  }

  beforeEach(() => {
    resetObservabilityMetricsForTests();
    jest.useFakeTimers();
    jest.setSystemTime(T0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps all events when none are stale", () => {
    ingestObservabilityEvent(makeEvent("fresh-1", T0 - 30 * MIN_MS));
    ingestObservabilityEvent(makeEvent("fresh-2", T0 - 5 * MIN_MS));

    // Advance the clock 30 minutes: both events are still within the 1h TTL.
    jest.setSystemTime(T0 + 30 * MIN_MS);
    purgeStaleEvents();

    const snapshot = getObservabilityMetricsSnapshot(HOUR_MS);
    expect(snapshot.counters.total).toBe(2);
  });

  it("removes only the stale events at the front of the buffer", () => {
    ingestObservabilityEvent(makeEvent("older", T0 - 30 * MIN_MS));
    ingestObservabilityEvent(makeEvent("newer", T0 - 5 * MIN_MS));

    // Advance the clock 45 minutes: "older" crosses the 1h TTL, "newer" does not.
    jest.setSystemTime(T0 + 45 * MIN_MS);
    purgeStaleEvents();

    const snapshot = getObservabilityMetricsSnapshot(HOUR_MS);
    expect(snapshot.counters.total).toBe(1);
    expect(snapshot.recentEvents.map((e) => e.id)).toEqual(["newer"]);
  });

  it("clears the entire buffer when every event is stale", () => {
    ingestObservabilityEvent(makeEvent("old-1", T0 - 10 * MIN_MS));
    ingestObservabilityEvent(makeEvent("old-2", T0 - 5 * MIN_MS));

    // Advance the clock two hours: everything is now beyond the TTL.
    jest.setSystemTime(T0 + 2 * HOUR_MS);
    purgeStaleEvents();

    const snapshot = getObservabilityMetricsSnapshot(HOUR_MS);
    expect(snapshot.counters.total).toBe(0);
    expect(snapshot.recentEvents).toHaveLength(0);
  });
});

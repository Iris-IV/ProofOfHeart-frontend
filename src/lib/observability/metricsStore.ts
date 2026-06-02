import type {
  ObservabilityAlert,
  ObservabilityEvent,
  ObservabilityMetricsSnapshot,
  ObservabilityRatesSnapshot,
} from './types';

const MAX_EVENTS = 2_000;
const DEFAULT_WINDOW_MS = 5 * 60_000;

const events: ObservabilityEvent[] = [];

function countBy<T extends string>(items: T[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
}

export function ingestObservabilityEvent(event: ObservabilityEvent): void {
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

function eventsInWindow(windowMs: number): ObservabilityEvent[] {
  const cutoff = Date.now() - windowMs;
  return events.filter((event) => new Date(event.timestamp).getTime() >= cutoff);
}

function computeRates(windowEvents: ObservabilityEvent[], windowMs: number): ObservabilityRatesSnapshot {
  const attempts = windowEvents.filter(
    (event) =>
      event.kind === 'transaction_success' ||
      event.kind === 'simulation_failure' ||
      event.kind === 'submission_failure' ||
      event.kind === 'confirmation_timeout' ||
      event.kind === 'confirmation_failed',
  ).length;

  const simulationFailures = windowEvents.filter((event) => event.kind === 'simulation_failure').length;
  const submissionFailures = windowEvents.filter((event) => event.kind === 'submission_failure').length;
  const rpcTimeouts = windowEvents.filter((event) => event.kind === 'rpc_timeout').length;
  const contractErrors = windowEvents.filter((event) => event.kind === 'contract_error').length;
  const rpcSamples = windowEvents.filter(
    (event) => event.category === 'rpc' || event.kind.startsWith('rpc'),
  ).length;

  const denom = Math.max(attempts, 1);
  const rpcDenom = Math.max(rpcSamples, 1);

  return {
    simulationFailureRate: simulationFailures / denom,
    submissionFailureRate: submissionFailures / denom,
    rpcTimeoutRate: rpcTimeouts / rpcDenom,
    contractErrorRate: contractErrors / denom,
    windowMs,
    sampleSize: windowEvents.length,
  };
}

export function evaluateAlerts(rates: ObservabilityRatesSnapshot): ObservabilityAlert[] {
  const simulationThreshold =
    Number(process.env.OBSERVABILITY_ALERT_SIMULATION_FAILURE_RATE) || 0.15;
  const submissionThreshold =
    Number(process.env.OBSERVABILITY_ALERT_SUBMISSION_FAILURE_RATE) || 0.1;
  const rpcTimeoutThreshold = Number(process.env.OBSERVABILITY_ALERT_RPC_TIMEOUT_RATE) || 0.2;

  const alerts: ObservabilityAlert[] = [];
  const now = new Date().toISOString();

  if (rates.sampleSize >= 10 && rates.simulationFailureRate >= simulationThreshold) {
    alerts.push({
      id: 'elevated-simulation-failures',
      severity: rates.simulationFailureRate >= simulationThreshold * 2 ? 'critical' : 'warning',
      message: 'Simulation failure rate is above the configured threshold.',
      metric: 'simulationFailureRate',
      currentRate: rates.simulationFailureRate,
      threshold: simulationThreshold,
      triggeredAt: now,
    });
  }

  if (rates.sampleSize >= 10 && rates.submissionFailureRate >= submissionThreshold) {
    alerts.push({
      id: 'elevated-submission-failures',
      severity: rates.submissionFailureRate >= submissionThreshold * 2 ? 'critical' : 'warning',
      message: 'Transaction submission failure rate is above the configured threshold.',
      metric: 'submissionFailureRate',
      currentRate: rates.submissionFailureRate,
      threshold: submissionThreshold,
      triggeredAt: now,
    });
  }

  if (rates.sampleSize >= 10 && rates.rpcTimeoutRate >= rpcTimeoutThreshold) {
    alerts.push({
      id: 'elevated-rpc-timeouts',
      severity: rates.rpcTimeoutRate >= rpcTimeoutThreshold * 2 ? 'critical' : 'warning',
      message: 'RPC timeout rate is above the configured threshold.',
      metric: 'rpcTimeoutRate',
      currentRate: rates.rpcTimeoutRate,
      threshold: rpcTimeoutThreshold,
      triggeredAt: now,
    });
  }

  return alerts;
}

export function getObservabilityMetricsSnapshot(
  windowMs: number = DEFAULT_WINDOW_MS,
): ObservabilityMetricsSnapshot {
  const windowEvents = eventsInWindow(windowMs);
  const rates = computeRates(windowEvents, windowMs);

  return {
    updatedAt: new Date().toISOString(),
    counters: {
      total: events.length,
      byKind: countBy(windowEvents.map((event) => event.kind)),
      byContractErrorCode: countBy(
        windowEvents
          .filter((event) => event.contractErrorCode !== undefined)
          .map((event) => String(event.contractErrorCode)),
      ),
      byOperation: countBy(
        windowEvents
          .filter((event) => event.operation)
          .map((event) => event.operation as string),
      ),
    },
    rates,
    alerts: evaluateAlerts(rates),
    recentEvents: [...windowEvents].slice(-50).reverse(),
  };
}

export function resetObservabilityMetricsForTests(): void {
  events.length = 0;
}

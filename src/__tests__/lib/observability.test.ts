import {
  getObservabilityMetricsSnapshot,
  ingestObservabilityEvent,
  resetObservabilityMetricsForTests,
} from '@/lib/observability/metricsStore';
import { classifySimulationFailure } from '@/lib/observability/classify';
import { buildObservabilityEvent } from '@/lib/observability/record';
import { ContractError } from '@/utils/contractErrors';

describe('observability', () => {
  beforeEach(() => {
    resetObservabilityMetricsForTests();
  });

  it('classifies Soroban contract errors with codes', () => {
    const failure = classifySimulationFailure(new Error('Error(Contract, #16)'), 'vote_on_campaign');
    expect(failure.kind).toBe('contract_error');
    expect(failure.contractErrorCode).toBe(ContractError.AlreadyVoted);
  });

  it('aggregates events and evaluates alert thresholds', () => {
    const now = new Date().toISOString();
    for (let i = 0; i < 8; i++) {
      ingestObservabilityEvent(
        buildObservabilityEvent(
          { category: 'transaction', kind: 'simulation_failure', message: 'sim failed' },
          { operation: 'contribute' },
        ),
      );
    }
    for (let i = 0; i < 2; i++) {
      ingestObservabilityEvent({
        id: `ok-${i}`,
        timestamp: now,
        category: 'transaction',
        kind: 'transaction_success',
        operation: 'contribute',
        network: 'testnet',
      });
    }

    const snapshot = getObservabilityMetricsSnapshot(5 * 60_000);
    expect(snapshot.counters.byKind.simulation_failure).toBe(8);
    expect(snapshot.alerts.some((alert) => alert.id === 'elevated-simulation-failures')).toBe(true);
  });
});

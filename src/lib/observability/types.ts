export type ObservabilityCategory = 'contract' | 'transaction' | 'rpc';

export type ObservabilityKind =
  | 'contract_error'
  | 'simulation_failure'
  | 'submission_failure'
  | 'confirmation_timeout'
  | 'confirmation_failed'
  | 'rpc_error'
  | 'rpc_timeout'
  | 'transaction_success';

export interface ObservabilityEvent {
  id: string;
  timestamp: string;
  category: ObservabilityCategory;
  kind: ObservabilityKind;
  /** Soroban contract method or RPC operation name when known. */
  operation?: string;
  /** Numeric ContractError enum value when applicable. */
  contractErrorCode?: number;
  contractErrorKey?: string;
  message?: string;
  network?: string;
  rpcStatus?: string;
  txHash?: string;
}

export interface ObservabilityCounterSnapshot {
  total: number;
  byKind: Record<string, number>;
  byContractErrorCode: Record<string, number>;
  byOperation: Record<string, number>;
}

export interface ObservabilityRatesSnapshot {
  simulationFailureRate: number;
  submissionFailureRate: number;
  rpcTimeoutRate: number;
  contractErrorRate: number;
  windowMs: number;
  sampleSize: number;
}

export interface ObservabilityAlert {
  id: string;
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  currentRate: number;
  threshold: number;
  triggeredAt: string;
}

export interface ObservabilityMetricsSnapshot {
  updatedAt: string;
  counters: ObservabilityCounterSnapshot;
  rates: ObservabilityRatesSnapshot;
  alerts: ObservabilityAlert[];
  recentEvents: ObservabilityEvent[];
}

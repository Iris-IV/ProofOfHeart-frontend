import type { ClassifiedFailure } from './classify';
import type { ObservabilityEvent, ObservabilityKind } from './types';

const NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK ??
  (process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE?.includes('Public') ? 'mainnet' : 'testnet');

function createEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `obs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildObservabilityEvent(
  failure: ClassifiedFailure,
  options?: { operation?: string; rpcStatus?: string; txHash?: string },
): ObservabilityEvent {
  return {
    id: createEventId(),
    timestamp: new Date().toISOString(),
    category: failure.category,
    kind: failure.kind,
    operation: options?.operation,
    contractErrorCode: failure.contractErrorCode,
    contractErrorKey: failure.contractErrorKey,
    message: failure.message,
    network: NETWORK,
    rpcStatus: options?.rpcStatus,
    txHash: options?.txHash,
  };
}

export function buildSuccessEvent(operation: string, txHash?: string): ObservabilityEvent {
  return {
    id: createEventId(),
    timestamp: new Date().toISOString(),
    category: 'transaction',
    kind: 'transaction_success',
    operation,
    network: NETWORK,
    txHash,
  };
}

function logStructured(event: ObservabilityEvent): void {
  if (process.env.NODE_ENV !== 'production') {
    console.info('[observability]', JSON.stringify(event));
  }
}

async function postToBackend(event: ObservabilityEvent): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/observability/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    });
  } catch {
    // Non-fatal: client metrics still logged locally.
  }
}

async function postToWebhook(event: ObservabilityEvent): Promise<void> {
  const webhookUrl = process.env.NEXT_PUBLIC_OBSERVABILITY_WEBHOOK_URL;
  if (!webhookUrl || typeof window === 'undefined') return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    });
  } catch {
    // Optional external logging backend.
  }
}

/** Record a structured observability event (console, API ingest, optional webhook). */
export function recordObservabilityEvent(event: ObservabilityEvent): void {
  logStructured(event);
  void postToBackend(event);
  void postToWebhook(event);
}

export function recordObservabilityFailure(
  failure: ClassifiedFailure,
  options?: { operation?: string; rpcStatus?: string; txHash?: string },
): void {
  recordObservabilityEvent(buildObservabilityEvent(failure, options));
}

export function recordObservabilitySuccess(operation: string, txHash?: string): void {
  recordObservabilityEvent(buildSuccessEvent(operation, txHash));
}

export function recordObservabilityKind(
  kind: ObservabilityKind,
  message: string,
  options?: { operation?: string; rpcStatus?: string; txHash?: string },
): void {
  const category =
    kind === 'contract_error'
      ? 'contract'
      : kind.startsWith('rpc')
        ? 'rpc'
        : 'transaction';
  recordObservabilityEvent({
    id: createEventId(),
    timestamp: new Date().toISOString(),
    category,
    kind,
    message,
    network: NETWORK,
    operation: options?.operation,
    rpcStatus: options?.rpcStatus,
    txHash: options?.txHash,
  });
}

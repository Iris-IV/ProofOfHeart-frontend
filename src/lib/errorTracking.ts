/**
 * Error tracking utility for production error monitoring.
 * Scrubs PII and wallet addresses before sending to external tracker.
 */

interface ErrorContext {
  action?: string;
  campaignId?: number;
  errorCode?: string;
  [key: string]: any;
}

interface ErrorReport {
  name: string;
  message: string;
  stack?: string;
  context?: ErrorContext;
}

const DSN = process.env.NEXT_PUBLIC_ERROR_TRACKING_DSN;
const IS_PROD = process.env.NODE_ENV === 'production';

// Regex patterns for PII scrubbing
const WALLET_ADDRESS_PATTERN = /G[A-Z0-9]{55}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PRIVATE_KEY_PATTERN = /S[A-Z0-9]{55}/g;

/**
 * Scrubs PII and sensitive data from error messages and context.
 */
function scrubPII(data: string): string {
  let scrubbed = data;
  
  // Replace wallet addresses with placeholder
  scrubbed = scrubbed.replace(WALLET_ADDRESS_PATTERN, '[WALLET_ADDRESS]');
  
  // Replace email addresses with placeholder
  scrubbed = scrubbed.replace(EMAIL_PATTERN, '[EMAIL]');
  
  // Replace private keys with placeholder
  scrubbed = scrubbed.replace(PRIVATE_KEY_PATTERN, '[PRIVATE_KEY]');
  
  return scrubbed;
}

/**
 * Scrubs PII from error context objects.
 */
function scrubContext(context: ErrorContext): ErrorContext {
  const scrubbed: ErrorContext = {};
  
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string') {
      scrubbed[key] = scrubPII(value);
    } else if (typeof value === 'object' && value !== null) {
      // Recursively scrub nested objects
      scrubbed[key] = JSON.parse(scrubPII(JSON.stringify(value)));
    } else {
      scrubbed[key] = value;
    }
  }
  
  return scrubbed;
}

/**
 * Sends error report to external tracking service.
 * Only active in production with valid DSN.
 */
async function sendToTracker(report: ErrorReport): Promise<void> {
  if (!IS_PROD || !DSN) {
    // In development, just log to console
    console.warn('[ErrorTracking] Would send to tracker in production:', report);
    return;
  }

  try {
    const response = await fetch(DSN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...report,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      }),
    });

    if (!response.ok) {
      console.error('[ErrorTracking] Failed to send error report:', response.statusText);
    }
  } catch (err) {
    console.error('[ErrorTracking] Network error sending report:', err);
  }
}

/**
 * Captures an error with optional context for tracking.
 */
export function captureError(error: Error, context?: ErrorContext): void {
  const report: ErrorReport = {
    name: error.name,
    message: scrubPII(error.message),
    stack: error.stack ? scrubPII(error.stack) : undefined,
    context: context ? scrubContext(context) : undefined,
  };

  // Send asynchronously without blocking
  void sendToTracker(report);
}

/**
 * Captures a failed transaction with context.
 */
export function captureTransactionError(
  action: string,
  campaignId: number,
  error: Error,
  errorCode?: string
): void {
  captureError(error, {
    action,
    campaignId,
    errorCode,
    type: 'transaction_failure',
  });
}

/**
 * Global error handler for unhandled errors.
 */
export function setupGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[ErrorTracking] Unhandled promise rejection:', event.reason);
    captureError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), {
      type: 'unhandled_promise_rejection',
    });
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('[ErrorTracking] Global error:', event.error);
    captureError(event.error || new Error(event.message), {
      type: 'global_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
}

import { captureError } from "./errorTracking";

export interface ErrorReportContext {
  [key: string]: unknown;
}

export interface ReportErrorOptions {
  context?: ErrorReportContext;
  message?: string;
  fallbackMessage?: string;
  notify?: (message: string) => void;
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return new Error(maybeMessage);
    }
    try {
      return new Error(JSON.stringify(error));
    } catch {
      return new Error("[Unserializable error object]");
    }
  }
  return new Error(String(error));
}

export function getErrorMessage(
  error: unknown,
  fallbackMessage = "Something went wrong. Please try again.",
): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown; error?: { message?: unknown } }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }

    const nestedMessage = (error as { error?: { message?: unknown } }).error?.message;
    if (typeof nestedMessage === "string" && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  return fallbackMessage;
}

export function reportError(error: unknown, options: ReportErrorOptions = {}): string {
  const normalizedError = toError(error);
  captureError(normalizedError, options.context);

  const message =
    options.message ?? getErrorMessage(normalizedError, options.fallbackMessage);

  if (options.notify) {
    options.notify(message);
  }

  return message;
}

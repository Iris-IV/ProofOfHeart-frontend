export const ACTION_TIMEOUT_MS = 45_000;

export class ActionTimeoutError extends Error {
  constructor() {
    super("This request is taking longer than expected. Please check your wallet and try again.");
    this.name = "ActionTimeoutError";
  }
}

export async function withActionTimeout<T>(
  action: Promise<T>,
  timeoutMs = ACTION_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new ActionTimeoutError()), timeoutMs);
  });

  try {
    return await Promise.race([action, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function getAsyncActionErrorMessage(
  error: unknown,
  parseError: (error: unknown) => string,
): string {
  if (error instanceof ActionTimeoutError) return error.message;
  return parseError(error);
}

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export const IS_MOCK_MODE = USE_MOCKS;

export function assertProductionContractConfig(): void {
  if (process.env.NODE_ENV === "production" && USE_MOCKS) {
    throw new Error(
      "Mock mode is disabled in production. Set NEXT_PUBLIC_USE_MOCKS=false before building or running the app.",
    );
  }
}

export const IS_MOCK_MODE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

let asserted = false;

export function assertProductionContractConfig(): void {
  if (asserted) return;
  asserted = true;
  if (process.env.NODE_ENV === "production" && IS_MOCK_MODE) {
    throw new Error(
      "Mock mode is disabled in production. Set NEXT_PUBLIC_USE_MOCKS=false before building or running the app.",
    );
  }
}

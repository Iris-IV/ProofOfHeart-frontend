import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { usePlatformStatus } from "@/hooks/usePlatformStatus";

const mockGetPlatformStatus = jest.fn();
jest.mock("@/lib/contractClient", () => ({
  getPlatformStatus: (...args: unknown[]) => mockGetPlatformStatus(...args),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })}>{children}</QueryClientProvider>
);

describe("contract platform status policy (#1761 #1762)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fails closed until status is known and blocks writes when paused", async () => {
    mockGetPlatformStatus.mockResolvedValue({
      isPaused: true, isCreationDisabled: false,
    });
    const { result } = renderHook(() => usePlatformStatus(), { wrapper });
    expect(result.current.isWriteDisabled).toBe(true);
    await waitFor(() => expect(result.current.isPaused).toBe(true));
    expect(result.current.isWriteDisabled).toBe(true);
    expect(result.current.isCreationBlocked).toBe(true);
  });

  it("disables only creation when the admin turns creation off", async () => {
    mockGetPlatformStatus.mockResolvedValue({
      isPaused: false, isCreationDisabled: true,
    });
    const { result } = renderHook(() => usePlatformStatus(), { wrapper });
    await waitFor(() => expect(result.current.isCreationDisabled).toBe(true));
    expect(result.current.isWriteDisabled).toBe(false);
    expect(result.current.isCreationBlocked).toBe(true);
  });

  it("allows normal writes when both flags are false", async () => {
    mockGetPlatformStatus.mockResolvedValue({ isPaused: false, isCreationDisabled: false });
    const { result } = renderHook(() => usePlatformStatus(), { wrapper });
    await waitFor(() => expect(result.current.isWriteDisabled).toBe(false));
    expect(result.current.isCreationBlocked).toBe(false);
  });
});

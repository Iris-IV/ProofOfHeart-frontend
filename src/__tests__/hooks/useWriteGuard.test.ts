import { renderHook, act } from "@testing-library/react";
import { useWriteGuard } from "@/hooks/useWriteGuard";

describe("useWriteGuard", () => {
  it("runs the action and returns its value", async () => {
    const { result } = renderHook(() => useWriteGuard());
    const value = await act(() => result.current.invoke("contribute", 1, async () => "tx-hash"));
    expect(value).toBe("tx-hash");
  });

  it("isPending returns false before and after an action", async () => {
    const { result } = renderHook(() => useWriteGuard());
    expect(result.current.isPending("contribute", 1)).toBe(false);
    await act(() => result.current.invoke("contribute", 1, async () => "ok"));
    expect(result.current.isPending("contribute", 1)).toBe(false);
  });

  it("second concurrent call for the same key returns null (no-op)", async () => {
    const { result } = renderHook(() => useWriteGuard());

    let resolve1!: (v: string) => void;
    const p1 = new Promise<string>((r) => {
      resolve1 = r;
    });

    // Start first call but don't await — it holds the key
    const firstCall = act(() => result.current.invoke("contribute", 1, () => p1));

    // Second call with same key while first is in-flight
    const secondResult = await act(() =>
      result.current.invoke("contribute", 1, async () => "should-not-run"),
    );
    expect(secondResult).toBeNull();

    // Resolve the first call
    resolve1("tx-hash");
    const firstResult = await firstCall;
    expect(firstResult).toBe("tx-hash");
  });

  it("different (action, campaignId) keys run concurrently without blocking", async () => {
    const { result } = renderHook(() => useWriteGuard());

    const [r1, r2] = await act(() =>
      Promise.all([
        result.current.invoke("contribute", 1, async () => "a"),
        result.current.invoke("contribute", 2, async () => "b"),
      ]),
    );
    expect(r1).toBe("a");
    expect(r2).toBe("b");
  });

  it("clears the key even when the action throws", async () => {
    const { result } = renderHook(() => useWriteGuard());

    await act(async () => {
      try {
        await result.current.invoke("contribute", 1, async () => {
          throw new Error("tx failed");
        });
      } catch {
        // expected
      }
    });

    expect(result.current.isPending("contribute", 1)).toBe(false);

    // Can invoke again after failure
    const value = await act(() => result.current.invoke("contribute", 1, async () => "retry-ok"));
    expect(value).toBe("retry-ok");
  });
});

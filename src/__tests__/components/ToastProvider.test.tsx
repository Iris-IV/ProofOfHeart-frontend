import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { TOAST_DURATIONS, ToastProvider, useToast } from "@/components/ToastProvider";

type Api = ReturnType<typeof useToast>;

/** Renders the provider and hands back its API. */
function setup() {
  let api!: Api;
  function Grab() {
    api = useToast();
    return null;
  }
  render(
    <ToastProvider>
      <Grab />
    </ToastProvider>,
  );
  return () => api;
}

/** Advance past the exit animation too. */
function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("ToastProvider", () => {
  it("announces errors as alerts inside an assertive live region", () => {
    const api = setup();
    act(() => api().showError("Transaction failed"));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Transaction failed");
    expect(alert).toHaveAttribute("data-type", "error");
    expect(screen.getByLabelText("Notifications")).toHaveAttribute("aria-live", "assertive");
  });

  it("keeps non-error toasts polite", () => {
    const api = setup();
    act(() => api().showSuccess("Saved"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Notifications")).toHaveAttribute("aria-live", "polite");
  });

  it.each([
    ["showSuccess", TOAST_DURATIONS.success],
    ["showInfo", TOAST_DURATIONS.info],
    ["showWarning", TOAST_DURATIONS.warning],
    ["showError", TOAST_DURATIONS.error],
  ] as const)("%s auto-dismisses after %dms", (method, duration) => {
    const api = setup();
    act(() => api()[method]("Hello"));

    advance(duration - 1);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    advance(1 + 200);
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("drives the countdown bar from the toast duration", () => {
    const api = setup();
    act(() => api().showInfo("Custom", { duration: 2500 }));

    const bar = screen.getByTestId("toast-countdown");
    expect(bar).toHaveClass("ui-countdown");
    expect(bar.style.getPropertyValue("--toast-duration")).toBe("2500ms");

    advance(2500 + 200);
    expect(screen.queryByText("Custom")).toBeNull();
  });

  it("pauses the timer and the bar while hovered, then resumes with the time left", () => {
    const api = setup();
    act(() => api().showSuccess("Hover me", { duration: 1000 }));
    const toast = screen.getByText("Hover me").closest("[data-type]")!;

    advance(600);
    fireEvent.pointerEnter(toast);
    expect(screen.getByTestId("toast-countdown")).toHaveAttribute("data-paused", "true");

    advance(5000);
    expect(screen.getByText("Hover me")).toBeInTheDocument();

    fireEvent.pointerLeave(toast);
    expect(screen.getByTestId("toast-countdown")).toHaveAttribute("data-paused", "false");
    advance(399);
    expect(screen.getByText("Hover me")).toBeInTheDocument();
    advance(1 + 200);
    expect(screen.queryByText("Hover me")).toBeNull();
  });

  it("pauses while focus is inside the toast", () => {
    const api = setup();
    act(() => api().showError("Focus me", { duration: 1000 }));
    const dismiss = screen.getByRole("button", { name: "Dismiss notification" });

    act(() => dismiss.focus());
    advance(5000);
    expect(screen.getByText("Focus me")).toBeInTheDocument();

    act(() => dismiss.blur());
    advance(1000 + 200);
    expect(screen.queryByText("Focus me")).toBeNull();
  });

  it("runs a button action (e.g. Retry) and dismisses the toast", () => {
    const api = setup();
    const retry = jest.fn();
    act(() => api().showError("Vote failed", { action: { label: "Retry vote", onClick: retry } }));

    fireEvent.click(screen.getByRole("button", { name: "Retry vote" }));
    expect(retry).toHaveBeenCalledTimes(1);
    advance(200);
    expect(screen.queryByText("Vote failed")).toBeNull();
  });

  it("dismisses from the close button", () => {
    const api = setup();
    act(() => api().showInfo("Bye"));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    advance(200);
    expect(screen.queryByText("Bye")).toBeNull();
  });

  it("renders link actions safely", () => {
    const api = setup();
    act(() =>
      api().showToastWithAction(
        "Donation sent.",
        { label: "View on Explorer", href: "https://stellar.expert/tx/abc" },
        "success",
      ),
    );
    const link = screen.getByRole("link", { name: "View on Explorer" });
    expect(link).toHaveAttribute("href", "https://stellar.expert/tx/abc");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("stacks at most three toasts, keeping the newest", () => {
    const api = setup();
    act(() => {
      for (const n of [1, 2, 3, 4]) api().showInfo(`Toast ${n}`);
    });
    expect(screen.queryByText("Toast 1")).toBeNull();
    expect(screen.getByText("Toast 4")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-type]")).toHaveLength(3);
  });

  it("supports the legacy showToast(message, type) call", () => {
    const api = setup();
    act(() => api().showToast("Heads up", "warning"));
    expect(screen.getByText("Heads up").closest("[data-type]")).toHaveAttribute(
      "data-type",
      "warning",
    );
  });

  it("throws outside the provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      renderHook(() => useToast(), {
        wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
      }),
    ).toThrow("useToast must be used within <ToastProvider>");
    spy.mockRestore();
  });
});

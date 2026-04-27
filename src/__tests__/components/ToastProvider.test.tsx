import { render, screen, act, fireEvent } from "@testing-library/react";
import { ToastProvider, useToast } from "../../../src/components/ToastProvider";

// Use fake timers for the auto-dismiss tests
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

const TestComponent = () => {
  const { showSuccess, showError, showWarning, showInfo, showToastWithAction } = useToast();

  return (
    <div>
      <button onClick={() => showSuccess("Success message")}>Success</button>
      <button onClick={() => showError("Error message")}>Error</button>
      <button onClick={() => showWarning("Warning message")}>Warning</button>
      <button onClick={() => showInfo("Info message")}>Info</button>
      <button
        onClick={() =>
          showToastWithAction("Action message", { label: "Click here", href: "https://example.com" })
        }
      >
        Action
      </button>
      <button onClick={() => showInfo("<script>alert('XSS')</script>")}>XSS</button>
    </div>
  );
};

describe("ToastProvider", () => {
  const renderProvider = () => {
    return render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
  };

  it("renders children correctly", () => {
    renderProvider();
    expect(screen.getByText("Success")).toBeInTheDocument();
  });

  it("shows different types of toasts", () => {
    renderProvider();
    
    fireEvent.click(screen.getByText("Success"));
    expect(screen.getByText("Success message")).toBeInTheDocument();
    
    fireEvent.click(screen.getByText("Error"));
    expect(screen.getByText("Error message")).toBeInTheDocument();
    
    fireEvent.click(screen.getByText("Warning"));
    expect(screen.getByText("Warning message")).toBeInTheDocument();
    
    fireEvent.click(screen.getByText("Info"));
    expect(screen.getByText("Info message")).toBeInTheDocument();
  });

  it("auto-dismisses toasts after 5000ms", () => {
    renderProvider();
    
    fireEvent.click(screen.getByText("Success"));
    expect(screen.getByText("Success message")).toBeInTheDocument();
    
    // Advance timer by 5000ms (auto dismiss timeout) + 300ms (CSS transition timeout)
    act(() => {
      jest.advanceTimersByTime(5300);
    });
    
    expect(screen.queryByText("Success message")).not.toBeInTheDocument();
  });

  it("caps concurrent toasts at 3", () => {
    renderProvider();
    
    fireEvent.click(screen.getByText("Success"));
    fireEvent.click(screen.getByText("Error"));
    fireEvent.click(screen.getByText("Warning"));
    fireEvent.click(screen.getByText("Info"));
    
    // The first one (Success) should be removed, the other 3 should be visible
    expect(screen.queryByText("Success message")).not.toBeInTheDocument();
    expect(screen.getByText("Error message")).toBeInTheDocument();
    expect(screen.getByText("Warning message")).toBeInTheDocument();
    expect(screen.getByText("Info message")).toBeInTheDocument();
  });

  it("dismisses a toast when the close button is clicked", () => {
    renderProvider();
    
    fireEvent.click(screen.getByText("Success"));
    expect(screen.getByText("Success message")).toBeInTheDocument();
    
    const closeButton = screen.getByLabelText("Dismiss notification");
    fireEvent.click(closeButton);
    
    // Fast-forward the 300ms transition timeout
    act(() => {
      jest.advanceTimersByTime(300);
    });
    
    expect(screen.queryByText("Success message")).not.toBeInTheDocument();
  });

  it("prevents XSS by rendering string as text, not HTML", () => {
    renderProvider();
    
    fireEvent.click(screen.getByText("XSS"));
    // If it was rendered as HTML, it might not have this exact text node if the browser parsed it as an invalid script tag.
    // Testing-library's getByText looks for Text nodes.
    // The fact that we can find it by exact string means it was rendered as text.
    expect(screen.getByText("<script>alert('XSS')</script>")).toBeInTheDocument();
  });

  it("renders toast with action correctly", () => {
    renderProvider();
    
    fireEvent.click(screen.getByText("Action"));
    expect(screen.getByText(/Action message/)).toBeInTheDocument();
    
    const link = screen.getByRole("link", { name: "Click here" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

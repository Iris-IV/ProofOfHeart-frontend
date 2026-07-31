import { render, screen, fireEvent } from "@testing-library/react";
import OnboardingTour from "@/components/OnboardingTour";


jest.mock("@/hooks/useOnboardingTour", () => ({
  useOnboardingTour: jest.fn(),
}));

import { useOnboardingTour } from "@/hooks/useOnboardingTour";

const mockDismiss = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useOnboardingTour as jest.Mock).mockReturnValue({ show: true, dismiss: mockDismiss });
});

describe("OnboardingTour", () => {
  it("renders the first step", () => {
    render(<OnboardingTour />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Connect your wallet")).toBeInTheDocument();
  });

  it("does not render when show is false", () => {
    (useOnboardingTour as jest.Mock).mockReturnValue({ show: false, dismiss: mockDismiss });
    render(<OnboardingTour />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("advances to next step", () => {
    render(<OnboardingTour />);
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Choose a cause")).toBeInTheDocument();
  });

  it("goes back to previous step", () => {
    render(<OnboardingTour />);
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Back"));
    expect(screen.getByText("Connect your wallet")).toBeInTheDocument();
  });

  it("calls dismiss when Skip is clicked", () => {
    render(<OnboardingTour />);
    fireEvent.click(screen.getByText("Skip"));
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it("shows Get started on the last step and calls dismiss", () => {
    render(<OnboardingTour />);
    // advance through all steps
    fireEvent.click(screen.getByText("Next")); // step 2
    fireEvent.click(screen.getByText("Next")); // step 3
    fireEvent.click(screen.getByText("Next")); // step 4
    expect(screen.getByText("Get started")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Get started"));
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });
});

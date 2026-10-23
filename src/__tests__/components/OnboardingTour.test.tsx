import { render, screen, fireEvent } from "@testing-library/react";
import OnboardingTour from "@/components/OnboardingTour";

const STORAGE_KEY = "onboarding_tour_dismissed";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      tourLabel: "Welcome tour",
      skip: "Skip",
      back: "Back",
      next: "Next",
      done: "Get started",
      stepProgress: `Step ${String(values?.current)} of ${String(values?.total)}`,
      step_connect_icon: "🔗",
      step_connect_title: "Connect your wallet",
      step_connect_body: "Connect body",
      step_chooseCause_icon: "🌟",
      step_chooseCause_title: "Choose a cause",
      step_chooseCause_body: "Choose body",
      step_contribute_icon: "💛",
      step_contribute_title: "Contribute",
      step_contribute_body: "Contribute body",
      step_confirm_icon: "✅",
      step_confirm_title: "Confirm & track",
      step_confirm_body: "Confirm body",
    };
    return map[key] ?? key;
  },
}));

beforeEach(() => {
  localStorage.clear();
});

describe("OnboardingTour", () => {
  it("renders the first step for a first-time visitor", async () => {
    render(<OnboardingTour />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Connect your wallet")).toBeInTheDocument();
  });

  it("does not render once the tour has been dismissed", () => {
    localStorage.setItem(STORAGE_KEY, "1");
    render(<OnboardingTour />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("advances to the next step", async () => {
    render(<OnboardingTour />);
    fireEvent.click(await screen.findByText("Next"));
    expect(screen.getByText("Choose a cause")).toBeInTheDocument();
  });

  it("goes back to the previous step", async () => {
    render(<OnboardingTour />);
    fireEvent.click(await screen.findByText("Next"));
    fireEvent.click(screen.getByText("Back"));
    expect(screen.getByText("Connect your wallet")).toBeInTheDocument();
  });

  it("hides the tour and remembers the dismissal when Skip is clicked", async () => {
    render(<OnboardingTour />);
    fireEvent.click(await screen.findByText("Skip"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("finishes the tour on the last step", async () => {
    render(<OnboardingTour />);
    fireEvent.click(await screen.findByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Get started")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Get started"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });
});

import { render, screen } from "@testing-library/react";
import FundingProgressBar from "@/components/FundingProgressBar";

describe("FundingProgressBar", () => {
  it("renders 0% when nothing has been raised", () => {
    render(<FundingProgressBar amountRaised={BigInt(0)} fundingGoal={BigInt(100_000_000)} />);
    expect(screen.getByText("0% funded")).toBeInTheDocument();
  });

  it("renders the correct percentage", () => {
    // 5 XLM raised out of 10 XLM = 50%
    render(
      <FundingProgressBar amountRaised={BigInt(50_000_000)} fundingGoal={BigInt(100_000_000)} />,
    );
    expect(screen.getByText("50% funded")).toBeInTheDocument();
  });

  it("caps at 100% when over-funded", () => {
    render(
      <FundingProgressBar amountRaised={BigInt(200_000_000)} fundingGoal={BigInt(100_000_000)} />,
    );
    expect(screen.getByText("100% funded")).toBeInTheDocument();
  });

  it("displays the raised and goal amounts in XLM", () => {
    render(
      <FundingProgressBar amountRaised={BigInt(50_000_000)} fundingGoal={BigInt(100_000_000)} />,
    );
    // 50_000_000 stroops = 5 XLM, 100_000_000 stroops = 10 XLM
    expect(screen.getByText(/5.*\/.*10.*XLM/)).toBeInTheDocument();
  });

  it("renders 0% when funding goal is zero", () => {
    render(<FundingProgressBar amountRaised={BigInt(0)} fundingGoal={BigInt(0)} />);
    expect(screen.getByText("0% funded")).toBeInTheDocument();
  });

  it("renders a motion progress bar element", () => {
    const { container } = render(
      <FundingProgressBar amountRaised={BigInt(25_000_000)} fundingGoal={BigInt(100_000_000)} />,
    );
    const bar = container.querySelector(".bg-linear-to-r");
    expect(bar).toBeInTheDocument();
  });

  it("exposes an accessible progressbar with current value", () => {
    render(
      <FundingProgressBar amountRaised={BigInt(50_000_000)} fundingGoal={BigInt(100_000_000)} />,
    );
    const progressbar = screen.getByRole("progressbar");

    expect(progressbar).toHaveAttribute("aria-valuenow", "50");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
    expect(progressbar).toHaveAttribute("aria-valuetext", "50% funded, 5 of 10 XLM");
    expect(progressbar).toHaveAttribute("aria-labelledby");
  });

  it("updates displayed percentage when amount raised increases", () => {
    const { rerender } = render(
      <FundingProgressBar amountRaised={BigInt(25_000_000)} fundingGoal={BigInt(100_000_000)} />,
    );
    expect(screen.getByText("25% funded")).toBeInTheDocument();

    rerender(
      <FundingProgressBar amountRaised={BigInt(50_000_000)} fundingGoal={BigInt(100_000_000)} />,
    );
    expect(screen.getByText("50% funded")).toBeInTheDocument();
  });
});

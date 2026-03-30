import { render, screen } from '@testing-library/react';
import FundingProgressBar from '@/components/FundingProgressBar';

describe('FundingProgressBar', () => {
  it('renders 0% when nothing has been raised', () => {
    render(
      <FundingProgressBar amountRaised={BigInt(0)} fundingGoal={BigInt(100_000_000)} />
    );
    expect(screen.getByText('0% funded')).toBeInTheDocument();
  });

  it('renders the correct percentage', () => {
    // 5 XLM raised out of 10 XLM = 50%
    render(
      <FundingProgressBar amountRaised={BigInt(50_000_000)} fundingGoal={BigInt(100_000_000)} />
    );
    expect(screen.getByText('50% funded')).toBeInTheDocument();
  });

  it('caps at 100% when over-funded', () => {
    render(
      <FundingProgressBar amountRaised={BigInt(200_000_000)} fundingGoal={BigInt(100_000_000)} />
    );
    expect(screen.getByText('100% funded')).toBeInTheDocument();
  });

  it('displays the raised and goal amounts in XLM', () => {
    render(
      <FundingProgressBar amountRaised={BigInt(50_000_000)} fundingGoal={BigInt(100_000_000)} />
    );
    // 50_000_000 stroops = 5 XLM, 100_000_000 stroops = 10 XLM
    expect(screen.getByText(/5.*\/.*10.*XLM/)).toBeInTheDocument();
  });

  it('renders 0% when funding goal is zero', () => {
    render(
      <FundingProgressBar amountRaised={BigInt(0)} fundingGoal={BigInt(0)} />
    );
    expect(screen.getByText('0% funded')).toBeInTheDocument();
  });

  it('sets the progress bar width proportionally', () => {
    const { container } = render(
      <FundingProgressBar amountRaised={BigInt(25_000_000)} fundingGoal={BigInt(100_000_000)} />
    );
    const bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar.style.width).toBe('25%');
  });
});

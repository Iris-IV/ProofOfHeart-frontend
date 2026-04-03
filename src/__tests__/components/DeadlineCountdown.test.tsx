import { render, screen, act } from '@testing-library/react';
import DeadlineCountdown from '@/components/DeadlineCountdown';

describe('DeadlineCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows "Campaign ended" when the deadline has passed', () => {
    const pastDeadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    render(<DeadlineCountdown deadline={pastDeadline} />);
    expect(screen.getByText('Campaign ended')).toBeInTheDocument();
  });

  it('shows remaining time when the deadline is in the future', () => {
    const futureDeadline = Math.floor(Date.now() / 1000) + 2 * 86400 + 3 * 3600 + 5 * 60;
    render(<DeadlineCountdown deadline={futureDeadline} />);
    expect(screen.getByText(/remaining/)).toBeInTheDocument();
    expect(screen.getByText(/2/)).toBeInTheDocument(); // days
  });

  it('does not show days when less than a day remains', () => {
    const futureDeadline = Math.floor(Date.now() / 1000) + 3 * 3600 + 30 * 60; // 3h 30m
    render(<DeadlineCountdown deadline={futureDeadline} />);
    expect(screen.queryByText(/d\s/)).not.toBeInTheDocument();
    expect(screen.getByText(/remaining/)).toBeInTheDocument();
  });

  it('updates to "Campaign ended" after the deadline passes', () => {
    const futureDeadline = Math.floor(Date.now() / 1000) + 120; // 2 minutes from now
    render(<DeadlineCountdown deadline={futureDeadline} />);
    expect(screen.getByText(/remaining/)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(3 * 60 * 1000); // advance 3 minutes
    });

    expect(screen.getByText('Campaign ended')).toBeInTheDocument();
  });
});

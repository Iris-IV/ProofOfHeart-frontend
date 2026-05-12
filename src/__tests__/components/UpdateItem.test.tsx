import { render, screen } from '@testing-library/react';
import UpdateItem from '@/components/UpdateItem';
import { CampaignUpdate } from '@/types';

const mockUpdate: CampaignUpdate = {
  id: 'test-update-1',
  campaignId: 1,
  content: 'This is a test update content. We have made great progress on our campaign!',
  authorAddress: 'GABC12345678901234567890123456789012345678901234567890',
  timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  signature: 'mock-signature',
};

describe('UpdateItem', () => {
  it('renders update content correctly', () => {
    render(<UpdateItem update={mockUpdate} />);
    expect(screen.getByText(mockUpdate.content)).toBeInTheDocument();
  });

  it('displays shortened author address', () => {
    render(<UpdateItem update={mockUpdate} />);
    expect(screen.getByText('GABC12...7890')).toBeInTheDocument();
  });

  it('shows "Creator" badge', () => {
    render(<UpdateItem update={mockUpdate} />);
    expect(screen.getByText('Creator')).toBeInTheDocument();
  });

  it('displays relative timestamp', () => {
    render(<UpdateItem update={mockUpdate} />);
    expect(screen.getByText(/1 h ago/)).toBeInTheDocument();
  });

  it('shows absolute timestamp on hover (title attribute)', () => {
    render(<UpdateItem update={mockUpdate} />);
    const timeElement = screen.getByText(/1 h ago/).closest('time');
    expect(timeElement).toHaveAttribute('title');
  });

  it('renders author avatar with initials', () => {
    render(<UpdateItem update={mockUpdate} />);
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('handles long content with proper wrapping', () => {
    const longUpdate: CampaignUpdate = {
      ...mockUpdate,
      content:
        'This is a very long update message that should wrap properly within the container. '.repeat(10),
    };
    render(<UpdateItem update={longUpdate} />);
    expect(screen.getByText(/This is a very long update/)).toBeInTheDocument();
  });

  it('displays "just now" for very recent updates', () => {
    const recentUpdate: CampaignUpdate = {
      ...mockUpdate,
      timestamp: Math.floor(Date.now() / 1000) - 30, // 30 seconds ago
    };
    render(<UpdateItem update={recentUpdate} />);
    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  it('displays minutes ago for updates less than an hour old', () => {
    const minutesAgoUpdate: CampaignUpdate = {
      ...mockUpdate,
      timestamp: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
    };
    render(<UpdateItem update={minutesAgoUpdate} />);
    expect(screen.getByText(/30 m ago/)).toBeInTheDocument();
  });

  it('displays days ago for updates older than a day', () => {
    const daysAgoUpdate: CampaignUpdate = {
      ...mockUpdate,
      timestamp: Math.floor(Date.now() / 1000) - 172800, // 2 days ago
    };
    render(<UpdateItem update={daysAgoUpdate} />);
    expect(screen.getByText(/2 d ago/)).toBeInTheDocument();
  });

  it('renders as an article element with proper ARIA label', () => {
    render(<UpdateItem update={mockUpdate} />);
    const article = screen.getByRole('article');
    expect(article).toHaveAttribute('aria-label');
  });
});

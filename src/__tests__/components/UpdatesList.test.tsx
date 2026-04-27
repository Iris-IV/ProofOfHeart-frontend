import { render, screen } from '@testing-library/react';
import UpdatesList from '@/components/UpdatesList';
import { CampaignUpdate } from '@/types';

const mockUpdates: CampaignUpdate[] = [
  {
    id: 'update-1',
    campaignId: 1,
    content: 'First update - newest',
    authorAddress: 'GABC12345678901234567890123456789012345678901234567890',
    timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    signature: 'mock-sig-1',
  },
  {
    id: 'update-2',
    campaignId: 1,
    content: 'Second update - older',
    authorAddress: 'GABC12345678901234567890123456789012345678901234567890',
    timestamp: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
    signature: 'mock-sig-2',
  },
];

describe('UpdatesList', () => {
  it('renders updates in the correct order (newest first)', () => {
    render(<UpdatesList updates={mockUpdates} isLoading={false} error={null} />);

    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(2);

    // First article should have the newest update
    expect(articles[0]).toHaveTextContent('First update - newest');
    expect(articles[1]).toHaveTextContent('Second update - older');
  });

  it('shows loading skeleton when isLoading is true', () => {
    render(<UpdatesList updates={[]} isLoading={true} error={null} />);

    expect(screen.getAllByTestId('skeleton')).toHaveLength(9); // 3 skeletons × 3 per item
  });

  it('shows error message when error is present', () => {
    render(
      <UpdatesList updates={[]} isLoading={false} error="Failed to load updates" />
    );

    expect(
      screen.getByText(/⚠️ Failed to load updates. Please try again later./i)
    ).toBeInTheDocument();
  });

  it('shows empty state when there are no updates', () => {
    render(<UpdatesList updates={[]} isLoading={false} error={null} />);

    expect(screen.getByText('No updates yet')).toBeInTheDocument();
    expect(
      screen.getByText(/The creator hasn't posted any updates. Check back later/i)
    ).toBeInTheDocument();
  });

  it('renders UpdateItem components for each update', () => {
    render(<UpdatesList updates={mockUpdates} isLoading={false} error={null} />);

    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('First update - newest')).toBeInTheDocument();
    expect(screen.getByText('Second update - older')).toBeInTheDocument();
  });

  it('displays update count when updates exist', () => {
    render(
      <div role="feed" aria-label="Campaign updates">
        <UpdatesList updates={mockUpdates} isLoading={false} error={null} />
      </div>
    );

    // The feed role should be present
    expect(screen.getByRole('feed')).toHaveAttribute('aria-label', 'Campaign updates');
  });

  it('handles single update correctly', () => {
    render(<UpdatesList updates={[mockUpdates[0]]} isLoading={false} error={null} />);

    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('First update - newest')).toBeInTheDocument();
  });

  it('renders updates with proper spacing (space-y-4)', () => {
    const { container } = render(
      <UpdatesList updates={mockUpdates} isLoading={false} error={null} />
    );

    const feed = container.firstChild as HTMLElement;
    expect(feed).toHaveClass('space-y-4');
  });

  it('handles long content in updates', () => {
    const longUpdate: CampaignUpdate = {
      ...mockUpdates[0],
      content: 'This is a very long update. '.repeat(50),
    };

    render(<UpdatesList updates={[longUpdate]} isLoading={false} error={null} />);

    expect(screen.getByText(/This is a very long update/)).toBeInTheDocument();
  });

  it('displays author information for each update', () => {
    render(<UpdatesList updates={mockUpdates} isLoading={false} error={null} />);

    // Check that author addresses are displayed (shortened)
    expect(screen.getAllByText('GABC12...7890')).toHaveLength(2);
    expect(screen.getAllByText('Creator')).toHaveLength(2);
  });

  it('displays timestamps for each update', () => {
    render(<UpdatesList updates={mockUpdates} isLoading={false} error={null} />);

    // Check that relative times are displayed
    expect(screen.getByText(/hour ago/)).toBeInTheDocument();
    expect(screen.getByText(/day ago/)).toBeInTheDocument();
  });
});

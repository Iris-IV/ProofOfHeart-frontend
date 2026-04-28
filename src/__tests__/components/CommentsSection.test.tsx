import { render, screen } from '@testing-library/react';
import React from 'react';
import CommentsSection from '@/components/CommentsSection';
import { useWallet } from '@/components/WalletContext';
import { useCampaignComments } from '@/hooks/useCampaignComments';
import { Campaign, Category } from '@/types';

jest.mock('@/components/WalletContext', () => ({
  useWallet: jest.fn(),
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/useCampaignComments', () => ({
  useCampaignComments: jest.fn(),
}));

jest.mock('@/components/CommentComposer', () => {
  return function MockCommentComposer() {
    return <div data-testid="mock-composer">Composer</div>;
  };
});

jest.mock('@/components/CommentsList', () => {
  return function MockCommentsList({ comments }: any) {
    return (
      <div data-testid="mock-list">
        List: {comments.length} comments
      </div>
    );
  };
});

describe('CommentsSection', () => {
  const mockCampaign: Campaign = {
    id: 1,
    creator: 'GABC',
    title: 'Test',
    description: 'Test',
    created_at: 1000,
    status: 'active',
    funding_goal: BigInt(100),
    deadline: 2000,
    amount_raised: BigInt(50),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: false,
    category: Category.Learner,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
  };

  const defaultMockComments = {
    comments: [
      { id: '1', parentId: null },
      { id: '2', parentId: '1' },
      { id: '3', parentId: null },
    ],
    isLoading: false,
    error: null,
    createComment: jest.fn(),
    isCreating: false,
    pinCommentMutation: jest.fn(),
    reportCommentMutation: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useWallet as jest.Mock).mockReturnValue({ publicKey: 'GUSER' });
    (useCampaignComments as jest.Mock).mockReturnValue(defaultMockComments);
  });

  it('renders heading with count of top-level comments', () => {
    render(<CommentsSection campaign={mockCampaign} />);
    
    // There are 2 top-level comments and 1 reply in the mock
    expect(screen.getByText('Comments / Q&A')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders Composer and List components', () => {
    render(<CommentsSection campaign={mockCampaign} />);
    
    expect(screen.getByTestId('mock-composer')).toBeInTheDocument();
    expect(screen.getByTestId('mock-list')).toHaveTextContent('List: 3 comments');
  });

  it('identifies if current user is creator', () => {
    // Current user is GABC, which matches campaign creator
    (useWallet as jest.Mock).mockReturnValue({ publicKey: 'GABC' });
    render(<CommentsSection campaign={mockCampaign} />);
    
    expect(useCampaignComments).toHaveBeenCalledWith(1, 'GABC');
  });
});

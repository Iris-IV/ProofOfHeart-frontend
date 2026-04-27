import React from 'react';
import { render, screen } from '@testing-library/react';
import CommentsList from '@/components/CommentsList';

// Mock CommentItem to isolate tests
jest.mock('@/components/CommentItem', () => {
  return function MockCommentItem({ comment, replies }: any) {
    return (
      <div data-testid="comment-item">
        <span>{comment.content}</span>
        {replies && replies.map((r: any) => (
          <div key={r.id} data-testid="comment-reply">
            {r.content}
          </div>
        ))}
      </div>
    );
  };
});

describe('CommentsList', () => {
  const mockComments = [
    {
      id: 'c1',
      campaignId: 1,
      content: 'First top comment',
      authorAddress: 'G1',
      timestamp: 100,
      parentId: null,
      signature: 'sig',
      isPinned: false,
      isReported: false,
    },
    {
      id: 'c2',
      campaignId: 1,
      content: 'Second top comment, pinned',
      authorAddress: 'G2',
      timestamp: 50, // older, but pinned
      parentId: null,
      signature: 'sig',
      isPinned: true,
      isReported: false,
    },
    {
      id: 'c3',
      campaignId: 1,
      content: 'Reply to C1',
      authorAddress: 'G3',
      timestamp: 60,
      parentId: 'c1',
      signature: 'sig',
      isPinned: false,
      isReported: false,
    },
  ];

  const defaultProps = {
    isLoading: false,
    error: null,
    isCreator: false,
    onReply: jest.fn(),
    onPin: jest.fn(),
    onReport: jest.fn(),
  };

  it('renders loading state', () => {
    render(<CommentsList comments={[]} {...defaultProps} isLoading={true} />);
    // Check for skeletons (we expect a few to be rendered)
    expect(screen.getByText((content, element) => element?.className.includes('space-y-4') || false)).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<CommentsList comments={[]} {...defaultProps} error="Failed" />);
    expect(screen.getByText(/Failed to load comments/i)).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<CommentsList comments={[]} {...defaultProps} />);
    expect(screen.getByText('No questions yet')).toBeInTheDocument();
  });

  it('renders threaded comments properly sorted', () => {
    render(<CommentsList comments={mockComments} {...defaultProps} />);
    
    const items = screen.getAllByTestId('comment-item');
    expect(items).toHaveLength(2); // Two top-level comments

    // First one should be 'c2' because it's pinned
    expect(items[0]).toHaveTextContent('Second top comment, pinned');

    // Second one should be 'c1' since pinned go first
    expect(items[1]).toHaveTextContent('First top comment');

    // Check reply inside 'c1'
    const replies = screen.getAllByTestId('comment-reply');
    expect(replies).toHaveLength(1);
    expect(replies[0]).toHaveTextContent('Reply to C1');
  });
});
